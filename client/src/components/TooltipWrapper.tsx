import { useGameState } from '../systems';
import Tooltip from './Tooltip';

interface TooltipWrapperProps {
  content: string;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
}

/**
 * Wrapper component that conditionally shows tooltips based on settings
 */
export default function TooltipWrapper({
  content,
  children,
  position,
  delay,
}: TooltipWrapperProps) {
  const showTooltips = useGameState((state) => state.settings.showTooltips ?? true);

  if (!showTooltips) {
    return <>{children}</>;
  }

  return (
    <Tooltip content={content} position={position} delay={delay}>
      {children}
    </Tooltip>
  );
}

