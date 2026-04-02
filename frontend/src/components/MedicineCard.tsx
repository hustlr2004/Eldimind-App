import type { Medicine } from '../types';

export function MedicineCard({
  medicine,
  onTaken,
  onSkipped,
}: {
  medicine: Medicine;
  onTaken?: (medicineId: string) => void;
  onSkipped?: (medicineId: string) => void;
}) {
  return (
    <article className="medicine-card">
      <div className="medicine-top">
        <div>
          <strong>{medicine.name}</strong>
          <p className="muted">
            {medicine.dosage || 'No dosage'} {medicine.scheduleTimes?.length ? `· ${medicine.scheduleTimes.join(', ')}` : ''}
          </p>
        </div>
      </div>
      {medicine.notes ? <p className="muted">{medicine.notes}</p> : null}
      {(onTaken || onSkipped) ? (
        <div className="medicine-actions">
          {onTaken ? <button className="ghost-button" onClick={() => onTaken(medicine._id)}>Taken</button> : null}
          {onSkipped ? <button className="ghost-button" onClick={() => onSkipped(medicine._id)}>Skip</button> : null}
        </div>
      ) : null}
    </article>
  );
}
