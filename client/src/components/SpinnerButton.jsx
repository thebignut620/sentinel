// Drop-in replacement for <button> that shows a spinner or checkmark based on state.
// Props: loading, success, children, className, ...rest
export default function SpinnerButton({ loading, success, children, className = '', disabled, ...rest }) {
  return (
    <button
      disabled={disabled || loading}
      className={`relative flex items-center justify-center gap-2 ${className}`}
      {...rest}
    >
      {loading && (
        <span className="animate-spinnerFade">
          <span className="h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full animate-spin inline-block" />
        </span>
      )}
      {success && !loading && (
        <span className="animate-checkmarkPop text-pine-300 font-bold">✓</span>
      )}
      <span className={loading || success ? 'opacity-80' : ''}>{children}</span>
    </button>
  );
}
