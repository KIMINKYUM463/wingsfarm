interface ErrorMessageProps {
  message?: string;
}

export default function ErrorMessage({ message }: ErrorMessageProps) {
  if (!message) return null;

  return (
    <p className="text-left description text-(--color-error) mt-1.5">
      {message}
    </p>
  );
}
