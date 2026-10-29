import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

/**
 * 마크다운 렌더러 컴포넌트
 * GitHub Flavored Markdown(GFM) 지원
 */
export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  return (
    <article className={className}>
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          // 헤딩 스타일
          h1: ({ children }) => <h1 className="h3 mb-6 mt-8 first:mt-0">{children}</h1>,
          h2: ({ children }) => <h2 className="h4 mb-4 mt-6">{children}</h2>,
          h3: ({ children }) => <h3 className="p-bold mb-3 mt-4">{children}</h3>,
          h4: ({ children }) => <h4 className="p-bold mb-2 mt-3">{children}</h4>,

          // 단락
          p: ({ children }) => <p className="mb-3 leading-relaxed">{children}</p>,

          // 리스트
          ul: ({ children }) => <ul className="mb-3 list-disc space-y-1 pl-6">{children}</ul>,
          ol: ({ children }) => <ol className="mb-3 list-decimal space-y-1 pl-6">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,

          // 링크
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline hover:opacity-80"
            >
              {children}
            </a>
          ),

          // 강조
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,

          // 인용
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-gray-300 pl-4 italic">{children}</blockquote>
          ),

          // 코드
          code: ({ children }) => (
            <code className="rounded bg-gray-100 px-1.5 py-0.5 text-sm">{children}</code>
          ),
          pre: ({ children }) => (
            <pre className="mb-3 overflow-x-auto rounded-lg bg-gray-100 p-4 text-sm">
              {children}
            </pre>
          ),

          // 구분선
          hr: () => <hr className="my-6 border-gray-200" />,

          // 테이블 (GFM)
          table: ({ children }) => (
            <div className="mb-3 overflow-x-auto">
              <table className="min-w-full border-collapse border border-gray-200">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-gray-50">{children}</thead>,
          tbody: ({ children }) => <tbody>{children}</tbody>,
          tr: ({ children }) => <tr className="border-b border-gray-200">{children}</tr>,
          th: ({ children }) => (
            <th className="border border-gray-200 px-4 py-2 text-left font-semibold">{children}</th>
          ),
          td: ({ children }) => <td className="border border-gray-200 px-4 py-2">{children}</td>,
        }}
      >
        {content}
      </Markdown>
    </article>
  );
}
