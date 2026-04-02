import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchJson, postJson } from '../../services/apiClient';
import { getRealtimeSocket } from '../../services/realtimeService';
import { useAuth } from '../../app/auth/AuthProvider';
import { usePreferences } from '../../app/preferences/PreferencesProvider';
import type { CallLogsResponse, LinkedContact, LinksResponse } from '../../types';

type OfferPayload = {
  from: string;
  to: string;
  type: 'voice' | 'video';
  offer?: RTCSessionDescriptionInit;
};

type AnswerPayload = {
  from: string;
  to: string;
  answer?: RTCSessionDescriptionInit;
};

type IcePayload = {
  from: string;
  to: string;
  candidate?: RTCIceCandidateInit;
};

export function CallPage() {
  const { user } = useAuth();
  const { t } = usePreferences();
  const queryClient = useQueryClient();
  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const [incomingCaller, setIncomingCaller] = useState<LinkedContact | null>(null);
  const [callStatus, setCallStatus] = useState<'idle' | 'ringing' | 'connecting' | 'connected' | 'ended'>('idle');
  const [muted, setMuted] = useState(false);
  const [cameraOn, setCameraOn] = useState(true);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const pendingOfferRef = useRef<RTCSessionDescriptionInit | null>(null);

  const linksQuery = useQuery({
    queryKey: ['links', 'me'],
    queryFn: () => fetchJson<LinksResponse>('/api/users/links/me'),
  });

  const availableContacts = useMemo(() => {
    if (user?.role === 'elder') return linksQuery.data?.links.linkedCaretakers || [];
    return linksQuery.data?.links.linkedElders || [];
  }, [linksQuery.data?.links, user]);

  useEffect(() => {
    if (selectedUid && availableContacts.some((contact) => contact.uid === selectedUid)) return;
    setSelectedUid(availableContacts[0]?.uid || null);
  }, [availableContacts, selectedUid]);

  const target = useMemo(() => {
    if (!selectedUid) return availableContacts[0] || null;
    return availableContacts.find((contact) => contact.uid === selectedUid) || null;
  }, [availableContacts, selectedUid]);

  const logsQuery = useQuery({
    queryKey: ['calls', user?.uid],
    queryFn: () => fetchJson<CallLogsResponse>(`/api/calls/user/${user?.uid}`),
    enabled: Boolean(user?.uid),
  });

  useEffect(() => {
    if (!user?.uid) return;
    const socket = getRealtimeSocket(user.uid);
    const onOffer = async (payload: OfferPayload) => {
      pendingOfferRef.current = payload.offer || null;
      const caller = availableContacts.find((contact) => contact.uid === payload.from) || null;
      setIncomingCaller(caller);
      if (caller) {
        setSelectedUid(caller.uid);
      }
      setCallStatus('ringing');
    };
    const onAnswer = async (payload: AnswerPayload) => {
      if (payload.answer && peerConnectionRef.current) {
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(payload.answer));
      }
      setCallStatus('connected');
    };
    const onCandidate = async (payload: IcePayload) => {
      if (payload.candidate && peerConnectionRef.current) {
        await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(payload.candidate));
      }
    };
    const onEnd = () => {
      cleanupCall();
      setCallStatus('ended');
    };
    const onMissed = async () => {
      cleanupCall();
      setCallStatus('ended');
      await queryClient.invalidateQueries({ queryKey: ['calls', user.uid] });
    };

    socket.on('call:offer', onOffer);
    socket.on('call:answer', onAnswer);
    socket.on('call:ice-candidate', onCandidate);
    socket.on('call:end', onEnd);
    socket.on('call:missed', onMissed);

    return () => {
      socket.off('call:offer', onOffer);
      socket.off('call:answer', onAnswer);
      socket.off('call:ice-candidate', onCandidate);
      socket.off('call:end', onEnd);
      socket.off('call:missed', onMissed);
    };
  }, [availableContacts, queryClient, user?.uid]);

  useEffect(() => {
    return () => {
      cleanupCall();
    };
  }, []);

  async function ensureLocalStream() {
    if (localStreamRef.current) return localStreamRef.current;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: cameraOn });
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      setMediaError(null);
      return stream;
    } catch {
      try {
        const audioOnly = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        localStreamRef.current = audioOnly;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = audioOnly;
        }
        setMediaError(t('audioOnlyMode'));
        return audioOnly;
      } catch {
        setMediaError(t('mediaError'));
        throw new Error('media-unavailable');
      }
    }
  }

  async function createPeerConnection(contactUid: string) {
    if (peerConnectionRef.current) return peerConnectionRef.current;

    const connection = new RTCPeerConnection({
      iceServers: [{ urls: ['stun:stun.l.google.com:19302'] }],
    });

    remoteStreamRef.current = new MediaStream();
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStreamRef.current;
    }

    connection.ontrack = (event) => {
      event.streams[0]?.getTracks().forEach((track) => remoteStreamRef.current?.addTrack(track));
    };

    connection.onicecandidate = (event) => {
      if (!event.candidate || !user?.uid) return;
      const socket = getRealtimeSocket(user.uid);
      socket.emit('call:ice-candidate', {
        from: user.uid,
        to: contactUid,
        candidate: event.candidate.toJSON(),
      });
    };

    const stream = await ensureLocalStream();
    stream.getTracks().forEach((track) => connection.addTrack(track, stream));
    peerConnectionRef.current = connection;
    return connection;
  }

  function cleanupCall() {
    peerConnectionRef.current?.close();
    peerConnectionRef.current = null;

    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
    remoteStreamRef.current = null;
    pendingOfferRef.current = null;
    setIncomingCaller(null);
  }

  const missedCallMutation = useMutation({
    mutationFn: async () => {
      if (!user?.uid || !target?.uid) throw new Error('No linked contact available');
      const elderUid = user.role === 'elder' ? user.uid : target.uid;
      const caretakerUid = user.role === 'caretaker' ? user.uid : target.uid;
      return postJson('/api/calls/missed', { elderUid, caretakerUid, type: 'video' });
    },
    onSuccess: async () => {
      if (user?.uid) {
        await queryClient.invalidateQueries({ queryKey: ['calls', user.uid] });
      }
    },
  });

  async function startCall() {
    if (!user?.uid || !target?.uid) return;
    try {
      const socket = getRealtimeSocket(user.uid);
      const connection = await createPeerConnection(target.uid);
      const offer = await connection.createOffer();
      await connection.setLocalDescription(offer);
      socket.emit('call:offer', {
        from: user.uid,
        to: target.uid,
        type: 'video',
        offer: connection.localDescription,
      });
      setCallStatus('connecting');
    } catch {
      setCallStatus('ended');
    }
  }

  async function connectCall() {
    if (!user?.uid || !target?.uid) return;
    if (!pendingOfferRef.current) return;

    try {
      const socket = getRealtimeSocket(user.uid);
      const connection = await createPeerConnection(target.uid);
      await connection.setRemoteDescription(new RTCSessionDescription(pendingOfferRef.current));
      const answer = await connection.createAnswer();
      await connection.setLocalDescription(answer);
      socket.emit('call:answer', { from: user.uid, to: target.uid, answer: connection.localDescription });
      setCallStatus('connected');
    } catch {
      setMediaError(t('mediaError'));
      setCallStatus('ended');
    }
  }

  function endCall() {
    if (!user?.uid || !target?.uid) {
      cleanupCall();
      setCallStatus('ended');
      return;
    }
    const socket = getRealtimeSocket(user.uid);
    socket.emit('call:end', { from: user.uid, to: target.uid });
    cleanupCall();
    setCallStatus('ended');
  }

  const logs = logsQuery.data?.logs || [];
  const activeName = incomingCaller?.fullName || target?.fullName || t('noLinkedContact');
  const activeInitial = activeName.slice(0, 1) || '?';

  useEffect(() => {
    if (!localStreamRef.current) return;
    localStreamRef.current.getAudioTracks().forEach((track) => {
      track.enabled = !muted;
    });
  }, [muted]);

  useEffect(() => {
    if (!localStreamRef.current) return;
    localStreamRef.current.getVideoTracks().forEach((track) => {
      track.enabled = cameraOn;
    });
  }, [cameraOn]);

  return (
    <section className="dashboard-page">
      <div className="hero-card caretaker-hero">
        <p className="eyebrow">{t('calls')}</p>
        <h1>{t('callTitle')}</h1>
        <p className="hero-text">{target ? `${t('linkedWith')} ${target.fullName}` : t('callNoLink')}</p>
      </div>

      <div className="dashboard-split">
        <div className="panel">
          <h2>{t('callControls')}</h2>
          {user?.role === 'caretaker' && availableContacts.length > 1 ? (
            <label className="settings-form">
              <span>{t('selectElder')}</span>
              <select value={selectedUid || ''} onChange={(event) => setSelectedUid(event.target.value || null)}>
                {availableContacts.map((contact) => (
                  <option key={contact.uid} value={contact.uid}>
                    {contact.fullName}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <div className="call-stage">
            <div className="call-avatar">{activeInitial}</div>
            <strong>{activeName}</strong>
            <p className="muted">{t('callStatus')}: {t(`callState_${callStatus}` as never)}</p>
            {mediaError ? <p className="error-text">{mediaError}</p> : null}
          </div>
          <div className="call-preview-grid">
            <div className="video-card">
              <div className="video-label">{t('yourCamera')}</div>
              <video autoPlay className="call-video" muted playsInline ref={localVideoRef} />
            </div>
            <div className="video-card">
              <div className="video-label">{t('familyCamera')}</div>
              <video autoPlay className="call-video" playsInline ref={remoteVideoRef} />
            </div>
          </div>
          <div className="call-controls">
            <button className="primary-button" disabled={!target} onClick={startCall} type="button">{t('startCall')}</button>
            <button className="ghost-button" disabled={!target || callStatus !== 'ringing'} onClick={connectCall} type="button">{t('answer')}</button>
            <button className="ghost-button" onClick={() => setMuted((value) => !value)} type="button">
              {muted ? t('unmute') : t('mute')}
            </button>
            <button className="ghost-button" onClick={() => setCameraOn((value) => !value)} type="button">
              {cameraOn ? t('cameraOff') : t('cameraOn')}
            </button>
            <button className="ghost-button" onClick={endCall} type="button">{t('endCall')}</button>
            <button className="ghost-button" disabled={!target || missedCallMutation.isPending} onClick={() => missedCallMutation.mutate()} type="button">{t('markMissed')}</button>
          </div>
        </div>
        <div className="panel">
          <h2>{t('recentCalls')}</h2>
          <div className="stack-list">
            {logs.map((log, index) => (
              <article className="feed-item feed-info" key={`${log.createdAt}-${index}`}>
                <strong>{log.status} · {log.type}</strong>
                <p className="muted">{new Date(log.createdAt).toLocaleString()}</p>
              </article>
            ))}
            {!logs.length ? <p className="muted">{t('noCalls')}</p> : null}
          </div>
        </div>
      </div>
    </section>
  );
}
