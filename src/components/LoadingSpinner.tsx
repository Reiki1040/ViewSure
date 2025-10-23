type LoadingSpinnerProps = {
  size?: 'small' | 'medium' | 'large';
  message?: string;
  className?: string;
};

const sizeClassMap: Record<Required<LoadingSpinnerProps>['size'], string> = {
  small: 'loading-spinner--small',
  medium: 'loading-spinner--medium',
  large: 'loading-spinner--large'
};

const LoadingSpinner = ({ size = 'medium', message, className }: LoadingSpinnerProps) => {
  const sizeClass = sizeClassMap[size];
  const classes = ['loading-spinner', sizeClass, className].filter(Boolean).join(' ');

  return (
    <div className={classes} role="status" aria-live="polite">
      <span className="loading-spinner__circle" aria-hidden="true" />
      {message ? <span className="loading-spinner__message">{message}</span> : null}
    </div>
  );
};

export default LoadingSpinner;
