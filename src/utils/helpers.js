export const avatarPalette = [
  "#5865f2",
  "#57f287",
  "#eb459e",
  "#fee75c",
  "#ed4245",
  "#3ba55c",
  "#7289da",
  "#faa61a"
];

export const pickColor = (seed = "") => {
  const hash = seed
    .split("")
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return avatarPalette[hash % avatarPalette.length];
};

export const initialsFromName = (name = "") =>
  name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

export const formatTime = (value) =>
  new Date(value).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit"
  });

export const formatDate = (value) =>
  new Date(value).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric"
  });

export const withTimeout = (promise, timeoutMs, message) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), timeoutMs);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
