import { lazy, Suspense, type ReactNode } from "react";

export type MarkdownEditorProps = Readonly<{
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  ariaDescribedBy?: string;
  ariaInvalid?: boolean;
  className?: string;
}>;

const Editor = lazy(() =>
  import("./editor.js").then(({ MarkdownEditor }) => ({
    default: MarkdownEditor,
  })),
);

export function LazyMarkdownEditor(
  props: MarkdownEditorProps & Readonly<{ fallback?: ReactNode }>,
) {
  const { fallback = null, ...editorProps } = props;
  return (
    <Suspense fallback={fallback}>
      <Editor {...editorProps} />
    </Suspense>
  );
}

export { MarkdownEditor } from "./editor.js";
