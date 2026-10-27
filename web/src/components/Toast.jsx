// A short confirmation after each review action, with a way to take it back.
export default function Toast({ message, onUndo, onClose }) {
  return (
    <div className="toast" role="status">
      <span>{message}</span>
      <button className="toast-undo" onClick={onUndo}>Undo</button>
      <button className="toast-close" onClick={onClose} aria-label="Dismiss">×</button>
    </div>
  );
}
