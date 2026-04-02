import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MedicineCard } from '../../components/MedicineCard';
import { fetchJson, postJson } from '../../services/apiClient';
import { useAuth } from '../../app/auth/AuthProvider';
import { usePreferences } from '../../app/preferences/PreferencesProvider';
import type { CaretakerEldersResponse, MedicinesResponse } from '../../types';

function useMedicineTarget(role?: 'elder' | 'caretaker', linkedElderUid?: string | null) {
  if (role === 'caretaker' && linkedElderUid) {
    return {
      queryKey: ['medicines', linkedElderUid],
      path: `/api/medicines/user/${linkedElderUid}`,
      bodyUserUid: linkedElderUid,
    };
  }

  return {
    queryKey: ['medicines', 'me'],
    path: '/api/medicines/me',
    bodyUserUid: undefined,
  };
}

export function MedicinesPage() {
  const { user } = useAuth();
  const { t } = usePreferences();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);

  const eldersQuery = useQuery({
    queryKey: ['caretaker-elders'],
    queryFn: () => fetchJson<CaretakerEldersResponse>('/api/caretaker/elders'),
    enabled: user?.role === 'caretaker',
  });
  const linkedElderUid = eldersQuery.data?.elders?.[0]?.uid || null;
  const target = useMedicineTarget(user?.role, linkedElderUid);

  const medicinesQuery = useQuery({
    queryKey: target.queryKey,
    queryFn: () => fetchJson<MedicinesResponse>(target.path),
    enabled: Boolean(user),
  });

  const markMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'taken' | 'skipped' }) =>
      postJson(`/api/medicines/${id}/taken`, { action }),
    onSuccess: async () => {
      setMessage(t('medicineUpdated'));
      await queryClient.invalidateQueries({ queryKey: target.queryKey });
      if (user?.role === 'elder') {
        await queryClient.invalidateQueries({ queryKey: ['feed', 'me'] });
      } else if (linkedElderUid) {
        await queryClient.invalidateQueries({ queryKey: ['feed', linkedElderUid] });
      }
    },
  });

  async function handleCreateMedicine(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const scheduleRaw = String(formData.get('scheduleTimes') || '');
    const payload = {
      userUid: target.bodyUserUid,
      name: String(formData.get('name') || ''),
      dosage: String(formData.get('dosage') || ''),
      scheduleTimes: scheduleRaw
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean),
      notes: String(formData.get('notes') || ''),
    };

    await postJson('/api/medicines', payload);
    setMessage(t('medicineAdded'));
    await queryClient.invalidateQueries({ queryKey: target.queryKey });
    event.currentTarget.reset();
  }

  const medicines = useMemo(() => medicinesQuery.data?.medicines || [], [medicinesQuery.data?.medicines]);

  return (
    <section className="dashboard-page">
      <div className="panel">
        <h1>{t('medicines')}</h1>
        <p className="muted">{user?.role === 'caretaker' ? t('caretakerMedicineDesc') : t('elderMedicineDesc')}</p>
      </div>

      <div className="dashboard-split">
        <div className="panel">
          <h2>{t('addMedicine')}</h2>
          <form className="settings-form" onSubmit={(event) => void handleCreateMedicine(event)}>
            <label>
              <span>{t('medicineName')}</span>
              <input name="name" placeholder="Metformin" />
            </label>
            <label>
              <span>{t('dosage')}</span>
              <input name="dosage" placeholder="500mg" />
            </label>
            <label>
              <span>{t('scheduleTimes')}</span>
              <input name="scheduleTimes" placeholder="08:00, 20:00" />
            </label>
            <label>
              <span>{t('notes')}</span>
              <input name="notes" placeholder="After meals" />
            </label>
            {message ? <p className="muted">{message}</p> : null}
            <button className="primary-button" type="submit">{t('saveMedicine')}</button>
          </form>
        </div>

        <div className="panel">
          <h2>{t('currentMedicines')}</h2>
          <div className="stack-list">
            {medicines.map((medicine) => (
              <MedicineCard
                key={medicine._id}
                medicine={medicine}
                onTaken={(id) => markMutation.mutate({ id, action: 'taken' })}
                onSkipped={(id) => markMutation.mutate({ id, action: 'skipped' })}
              />
            ))}
            {!medicines.length ? <p className="muted">{t('noMedicines')}</p> : null}
          </div>
        </div>
      </div>
    </section>
  );
}
