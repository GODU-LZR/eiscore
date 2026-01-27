const DEFAULT_PORT = 8078;
const DEFAULT_PATH = '/ws';

let client = null;

const createClient = () => {
  const listeners = new Set();
  let socket = null;
  let retryTimer = null;
  let closed = false;

  const buildUrl = () => {
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const host = window.location.hostname || 'localhost';
    return `${proto}://${host}:${DEFAULT_PORT}${DEFAULT_PATH}`;
  };

  const notify = (payload) => {
    listeners.forEach((fn) => {
      try {
        fn(payload);
      } catch (err) {
        // ignore listener errors
      }
    });
  };

  const connect = () => {
    if (closed || socket) return;
    try {
      socket = new WebSocket(buildUrl());
    } catch (err) {
      scheduleReconnect();
      return;
    }

    socket.addEventListener('message', (event) => {
      if (!event?.data) return;
      try {
        const payload = JSON.parse(event.data);
        notify(payload);
      } catch (err) {
        // ignore invalid payload
      }
    });

    const handleClose = () => {
      socket = null;
      scheduleReconnect();
    };

    socket.addEventListener('close', handleClose);
    socket.addEventListener('error', handleClose);
  };

  const scheduleReconnect = () => {
    if (closed || retryTimer) return;
    retryTimer = setTimeout(() => {
      retryTimer = null;
      connect();
    }, 1000);
  };

  const subscribe = (fn) => {
    if (typeof fn !== 'function') return () => {};
    listeners.add(fn);
    connect();
    return () => listeners.delete(fn);
  };

  const close = () => {
    closed = true;
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
    if (socket) {
      socket.close();
      socket = null;
    }
    listeners.clear();
  };

  return { subscribe, close };
};

export const getRealtimeClient = () => {
  if (!client) client = createClient();
  return client;
};
