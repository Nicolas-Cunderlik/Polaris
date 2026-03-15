const hashString = (value: string): number => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

export const getRouteColor = (id: string, saturation = 72, lightness = 46): string => {
  const hue = hashString(id) % 360;
  return `hsl(${hue} ${saturation}% ${lightness}%)`;
};
