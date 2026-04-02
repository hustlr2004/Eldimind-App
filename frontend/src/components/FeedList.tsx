import type { FeedItem } from '../types';

const toneClass: Record<string, string> = {
  critical: 'feed-critical',
  warning: 'feed-warning',
  info: 'feed-info',
};

export function FeedList({ items, emptyMessage }: { items: FeedItem[]; emptyMessage: string }) {
  if (!items.length) {
    return <div className="panel"><p className="muted">{emptyMessage}</p></div>;
  }

  return (
    <div className="feed-list">
      {items.map((item, index) => (
        <article className={`feed-item ${toneClass[item.severity] || 'feed-info'}`} key={`${item.type}-${item.timestamp}-${index}`}>
          <div>
            <strong>{item.title}</strong>
            <p className="muted">{item.description}</p>
          </div>
          <time className="feed-time">{new Date(item.timestamp).toLocaleString()}</time>
        </article>
      ))}
    </div>
  );
}
