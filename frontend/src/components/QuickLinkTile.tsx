import { Link } from 'react-router-dom';

export function QuickLinkTile({
  title,
  description,
  to,
}: {
  title: string;
  description: string;
  to: string;
}) {
  return (
    <Link className="quick-tile" to={to}>
      <strong>{title}</strong>
      <span>{description}</span>
    </Link>
  );
}
