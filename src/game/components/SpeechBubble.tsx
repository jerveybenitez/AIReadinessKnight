/**
 * The hover/focus bubble: the hovered option's full text in the top band, tail pointing down at
 * the target it describes. Screen readers read the option from the target button itself, so the
 * bubble is aria-hidden — it is a convenience, not the only way to read an option.
 */

export interface SpeechBubbleProps {
  text: string
  /** Where the tail sits inside the bubble, 0–100 (% of bubble width). */
  tailPercent: number
}

export function SpeechBubble({ text, tailPercent }: SpeechBubbleProps) {
  return (
    <div className="ark-bubble" aria-hidden="true">
      <p className="ark-bubble-text">{text}</p>
      <span className="ark-bubble-tail" style={{ left: `${tailPercent}%` }} />
    </div>
  )
}
