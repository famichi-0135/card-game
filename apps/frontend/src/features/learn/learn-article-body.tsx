import ReactMarkdown from "react-markdown";

export default function LearnArticleBody({ body }: { body: string }) {
  return (
    <div className="mt-10 max-w-3xl border-y border-slate-300 py-8">
      <ReactMarkdown
        components={{
          h2: ({ children }) => (
            <h2 className="mt-8 text-xl font-semibold first:mt-0">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mt-6 text-lg font-semibold">{children}</h3>
          ),
          li: ({ children }) => (
            <li className="ml-5 list-disc pl-1 leading-7">{children}</li>
          ),
          p: ({ children }) => (
            <p className="mt-4 leading-7 text-slate-800">{children}</p>
          ),
          ul: ({ children }) => <ul className="mt-4">{children}</ul>,
        }}
        skipHtml
      >
        {body}
      </ReactMarkdown>
    </div>
  );
}
