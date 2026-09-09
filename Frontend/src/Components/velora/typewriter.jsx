import { useEffect, useState } from "react";

export function Typewriter({
  words = [],
  typeSpeed = 70,
  deleteSpeed = 40,
  holdTime = 1800,
  loop = true,
  cursor = true,
  className = "",
  ...props
}) {
  const [wordIndex, setWordIndex] = useState(0);
  const [text, setText] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!words.length) return;

    const word = words[wordIndex];
    let timeout;

    if (!deleting && text.length < word.length) {
      timeout = setTimeout(() => {
        setText(word.slice(0, text.length + 1));
      }, typeSpeed);
    } else if (!deleting && text.length === word.length) {
      timeout = setTimeout(() => {
        if (loop || wordIndex < words.length - 1) {
          setDeleting(true);
        }
      }, holdTime);
    } else if (deleting && text.length > 0) {
      timeout = setTimeout(() => {
        setText(word.slice(0, text.length - 1));
      }, deleteSpeed);
    } else {
      timeout = setTimeout(() => {
        setDeleting(false);
        setWordIndex((current) =>
          current >= words.length - 1 ? (loop ? 0 : current) : current + 1
        );
      }, deleteSpeed);
    }

    return () => clearTimeout(timeout);
  }, [
    text,
    deleting,
    wordIndex,
    words,
    typeSpeed,
    deleteSpeed,
    holdTime,
    loop,
  ]);

  if (!words.length) return null;

  return (
    <span className={`inline-block ${className}`} {...props}>
      {text}
      {cursor && <span className="ml-1 animate-pulse">|</span>}
    </span>
  );
}