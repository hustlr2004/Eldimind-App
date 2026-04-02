import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { buildApiUrl, fetchJson, postJson } from '../../services/apiClient';
import { useAuth } from '../../app/auth/AuthProvider';
import { usePreferences } from '../../app/preferences/PreferencesProvider';
import type { CaretakerEldersResponse, PhotosResponse } from '../../types';

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function PhotosPage() {
  const { user } = useAuth();
  const { t } = usePreferences();
  const queryClient = useQueryClient();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [caption, setCaption] = useState('');
  const [selectedElderUid, setSelectedElderUid] = useState<string | null>(null);

  const eldersQuery = useQuery({
    queryKey: ['caretaker-elders'],
    queryFn: () => fetchJson<CaretakerEldersResponse>('/api/caretaker/elders'),
    enabled: user?.role === 'caretaker',
  });

  useEffect(() => {
    const firstUid = eldersQuery.data?.elders?.[0]?.uid || null;
    if (selectedElderUid && eldersQuery.data?.elders?.some((elder) => elder.uid === selectedElderUid)) return;
    if (user?.role === 'elder') return;
    setSelectedElderUid(firstUid);
  }, [eldersQuery.data?.elders, selectedElderUid, user?.role]);

  const targetUid = useMemo(() => {
    if (user?.role === 'elder') return user.uid;
    return selectedElderUid || eldersQuery.data?.elders?.[0]?.uid || null;
  }, [eldersQuery.data?.elders, selectedElderUid, user]);

  const photosQuery = useQuery({
    queryKey: ['photos', targetUid],
    queryFn: () => fetchJson<PhotosResponse>(`/api/photos/user/${targetUid}`),
    enabled: Boolean(targetUid),
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile || !targetUid) throw new Error('Choose a photo first');
      const imageBase64 = await fileToBase64(selectedFile);
      return postJson('/api/photos', {
        userUid: user?.role === 'caretaker' ? targetUid : undefined,
        imageBase64,
        mimeType: selectedFile.type || 'image/jpeg',
        caption,
        analyze: true,
      });
    },
    onSuccess: async () => {
      setSelectedFile(null);
      setCaption('');
      await queryClient.invalidateQueries({ queryKey: ['photos', targetUid] });
    },
  });

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    setSelectedFile(event.target.files?.[0] || null);
  }

  const photos = photosQuery.data?.photos || [];

  return (
    <section className="dashboard-page">
      <div className="hero-card caretaker-hero">
        <p className="eyebrow">{t('photoJournal')}</p>
        <h1>{t('photoJournalTitle')}</h1>
        <p className="hero-text">{t('photoJournalSubtitle')}</p>
      </div>

      <div className="dashboard-split">
        <div className="panel">
          <h2>{t('uploadPhoto')}</h2>
          <div className="settings-form">
            {user?.role === 'caretaker' && eldersQuery.data?.elders && eldersQuery.data.elders.length > 1 ? (
              <label>
                <span>{t('selectElder')}</span>
                <select value={targetUid || ''} onChange={(event) => setSelectedElderUid(event.target.value || null)}>
                  {eldersQuery.data.elders.map((elder) => (
                    <option key={elder.uid} value={elder.uid}>
                      {elder.fullName}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label>
              <span>{t('choosePhoto')}</span>
              <input accept="image/*" type="file" onChange={onFileChange} />
            </label>
            <label>
              <span>{t('caption')}</span>
              <input value={caption} onChange={(event) => setCaption(event.target.value)} />
            </label>
            <button className="primary-button" disabled={!selectedFile || uploadMutation.isPending} onClick={() => uploadMutation.mutate()} type="button">
              {uploadMutation.isPending ? t('uploading') : t('uploadAndAnalyze')}
            </button>
          </div>
        </div>
        <div className="panel">
          <h2>{t('gallery')}</h2>
          <div className="photo-grid">
            {photos.map((photo, index) => (
              <article className="photo-card" key={`${photo.imageUrl}-${index}`}>
                <img alt={photo.caption || 'Photo journal'} src={photo.imageUrl.startsWith('/uploads') ? buildApiUrl(photo.imageUrl) : photo.imageUrl} />
                <div className="photo-meta">
                  <strong>{photo.caption || t('photoJournal')}</strong>
                  <p className="muted">{new Date(photo.createdAt).toLocaleDateString()}</p>
                </div>
              </article>
            ))}
            {!photos.length ? <p className="muted">{t('noPhotos')}</p> : null}
          </div>
        </div>
      </div>
    </section>
  );
}
