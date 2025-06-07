export const isMobileDevice = (): boolean => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent,
  );
};

export const isIosSafari = (): boolean => {
  const userAgent = window.navigator.userAgent;
  const isIos = !!userAgent.match(/iPad/i) || !!userAgent.match(/iPhone/i);
  const isWebkit = !!userAgent.match(/WebKit/i);
  return isIos && isWebkit && !userAgent.match(/CriOS/i);
};
