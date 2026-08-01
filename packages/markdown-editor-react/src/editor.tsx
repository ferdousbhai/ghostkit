import {
  Editor,
  defaultValueCtx,
  editorViewOptionsCtx,
  rootCtx,
} from "@milkdown/core";
import { history } from "@milkdown/plugin-history";
import { listener, listenerCtx } from "@milkdown/plugin-listener";
import { automd } from "@milkdown/plugin-automd";
import { commonmark } from "@milkdown/preset-commonmark";
import { gfm } from "@milkdown/preset-gfm";
import { Milkdown, MilkdownProvider, useEditor } from "@milkdown/react";
import type { MarkdownEditorProps } from "./index.js";

function EditorInner({
  ariaDescribedBy,
  ariaInvalid,
  ariaLabel = "Markdown document",
  className,
  onChange,
  placeholder,
  value,
}: MarkdownEditorProps) {
  useEditor((root) =>
    Editor.make()
      .config((context) => {
        context.set(rootCtx, root);
        context.set(defaultValueCtx, value);
        context
          .get(listenerCtx)
          .markdownUpdated((_, markdown) => onChange(markdown));
        context.update(editorViewOptionsCtx, (previous) => ({
          ...previous,
          attributes: {
            ...previous.attributes,
            "aria-label": ariaLabel,
            "data-placeholder": placeholder ?? "",
          },
        }));
      })
      .use(commonmark)
      .use(gfm)
      .use(history)
      .use(listener)
      .use(automd),
  );

  return (
    <div
      aria-describedby={ariaDescribedBy}
      aria-invalid={ariaInvalid}
      className={["ghostkit-markdown-editor", className]
        .filter(Boolean)
        .join(" ")}
      data-placeholder={placeholder}
    >
      <Milkdown />
    </div>
  );
}

export function MarkdownEditor(props: MarkdownEditorProps) {
  return (
    <MilkdownProvider>
      <EditorInner {...props} />
    </MilkdownProvider>
  );
}
