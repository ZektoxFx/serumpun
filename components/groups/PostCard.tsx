import { MessageButton } from '@/components/app/MessageButton';
import { CommentForm } from '@/components/groups/CommentForm';
import { HelpfulButton } from '@/components/groups/HelpfulButton';
import { POST_TYPE_TAG } from '@/components/groups/groupStyle';
import { Avatar } from '@/components/ui/Avatar';
import { Tag } from '@/components/ui/Tag';
import { TimeAgo } from '@/components/ui/TimeAgo';
import { topAnswer, type PublicComment, type PublicPost } from '@/lib/domain/community';
import { t, type Lang } from '@/lib/i18n';

/**
 * A post in a group: author, type, text, a question's Top answer, and its comments behind "Comments · n", each with
 * Helpful. Members (`canAct`) comment and vote; everyone else reads. A Share & Lend post offers "Message [owner]" to any
 * verified resident (`canMessage`) but its owner.
 */
export function PostCard({
  post,
  comments,
  lang,
  canAct,
  canMessage,
}: {
  post: PublicPost;
  comments: PublicComment[];
  lang: Lang;
  canAct: boolean;
  canMessage: boolean;
}) {
  const top = post.type === 'question' ? comments.find((c) => c.id === topAnswer(comments)) : undefined;
  const tag = POST_TYPE_TAG[post.type];
  const author = post.author_name ?? '–';
  // Flex columns, not grids: a grid column grows to its widest child (a comment box is 20 characters wide by default),
  // which would push the page sideways on a narrow phone.
  return (
    <article className="flex flex-col gap-2.5 rounded-2xl border border-line bg-surface p-3.5 shadow-card">
      <header className="flex items-center gap-2.5">
        <Avatar name={author} size={36} />
        {/* These lines wrap rather than truncate: no-wrap text would widen the page on a narrow phone. */}
        <div className="min-w-0 flex-1">
          <p className="break-words text-sm font-bold">{author}</p>
          <p className="break-words text-xs text-muted-2">
            {post.author_neighbourhood && `${post.author_neighbourhood} · `}
            <TimeAgo date={post.created_at} />
          </p>
        </div>
        {tag && <Tag variant={tag}>{t(lang, `group.type.${post.type}`)}</Tag>}
      </header>
      <p className="whitespace-pre-line break-words">{post.body}</p>
      {post.type === 'share_lend' && post.author_id && !post.is_mine && (
        <MessageButton
          contextType="post"
          contextId={post.id}
          label={
            <>
              <span aria-hidden="true">💬</span> {t(lang, 'messages.messageOwner', { name: author })}
            </>
          }
          canAct={canMessage}
        />
      )}
      {top && (
        <div className="grid gap-1 rounded-xl bg-tint-green p-3">
          <p className="text-xs font-extrabold text-green-text">
            ✓ {t(lang, 'group.topAnswer')} · {top.author_name}
          </p>
          <p className="whitespace-pre-line break-words text-sm">{top.body}</p>
          <p className="text-xs font-bold text-green-text">
            <span aria-hidden="true">👍 </span>
            {t(lang, 'group.helpful', { n: top.helpful_count })}
          </p>
        </div>
      )}
      <details className="group">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1.5 rounded-lg text-sm font-bold text-muted-2 [&::-webkit-details-marker]:hidden">
          <span aria-hidden="true">💬</span> {t(lang, 'group.comments', { n: post.comment_count })}
          <span aria-hidden="true" className="ml-auto transition-transform group-open:rotate-180 motion-reduce:transition-none">
            ▾
          </span>
        </summary>
        <div className="flex flex-col gap-2 pt-1">
          {comments.length === 0 ? (
            <p className="text-sm text-muted-2">{t(lang, 'group.comment.empty')}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {comments.map((c) => (
                <li key={c.id} className="flex gap-2">
                  <Avatar name={c.author_name ?? '–'} size={28} className="mt-1" />
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5 rounded-xl bg-soft px-3 pb-1 pt-2">
                    <p className="text-xs">
                      <span className="font-bold">{c.author_name ?? '–'}</span> · <TimeAgo date={c.created_at} className="text-muted-2" />
                    </p>
                    <p className="whitespace-pre-line break-words text-sm">{c.body}</p>
                    <HelpfulButton
                      commentId={c.id}
                      author={c.author_name ?? ''}
                      count={c.helpful_count}
                      on={c.my_helpful}
                      canAct={canAct && !c.is_mine}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
          {canAct && <CommentForm postId={post.id} />}
        </div>
      </details>
    </article>
  );
}
