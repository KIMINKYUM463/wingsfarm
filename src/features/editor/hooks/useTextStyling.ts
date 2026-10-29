import { useCallback } from 'react';
import { KonvaTextElement } from '@/shared/types/konva';

export const useTextStyling = (element: KonvaTextElement) => {
  const getGradientStyle = useCallback(() => {
    if (element.fillPriority === 'linear-gradient' && element.fillLinearGradientColorStops) {
      const stops = element.fillLinearGradientColorStops;
      const colorStops = [];
      for (let i = 0; i < stops.length; i += 2) {
        colorStops.push(`${stops[i + 1]} ${parseFloat(String(stops[i])) * 100}%`);
      }
      return {
        backgroundImage: `linear-gradient(to right, ${colorStops.join(', ')})`,
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        color: 'transparent',
      };
    }
    return { color: element.fill as string };
  }, [element]);

  return {
    getGradientStyle,
  };
};