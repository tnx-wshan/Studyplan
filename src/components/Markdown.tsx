"use client";

import "katex/dist/katex.min.css";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";
import { cleanAiText } from "@/lib/ai/text";
import { cn } from "./ui";

/** AI 답변 표시 (breaks: 직접 쓴 글처럼 한 줄 바꿈도 그대로 보여줄 때): 마크다운 + 수식(KaTeX). 링크는 새 탭으로, 원시 HTML은 렌더링하지 않는다. */
export function Markdown({ children, className, breaks }: { children: string; className?: string; breaks?: boolean }) {
  const text = cleanAiText(children);
  return (
    <div className={cn("md", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: "ignore" }]]}
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {breaks ? text.replace(/\n/g, "  \n") : text}
      </ReactMarkdown>
    </div>
  );
}
