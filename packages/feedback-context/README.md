# `@summonghost/feedback-context`

Small, provider-neutral helpers for attaching stored reactions to the exact
assistant messages they describe in a temporary model view.

```ts
import {
  FEEDBACK_CONTEXT_POLICY,
  decorateAssistantMessageFeedback,
} from "@summonghost/feedback-context";

const modelMessages = decorateAssistantMessageFeedback(messages, [
  { messageIndex: 1, reactions: [{ value: "👍" }] },
]);
```

The canonical transcript is never mutated. Private feedback renders as
`<feedback>👍</feedback>`; attributed group feedback renders as
`<feedback by="Alex">👍</feedback>`.

Applications own reaction ingestion, authorization, message-ID mapping,
persistence, retention, and the decision about which active feedback to load.
