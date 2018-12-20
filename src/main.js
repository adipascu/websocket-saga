import { put, take, call, race, fork, cancel } from 'redux-saga/effects';
/* eslint-disable import/no-extraneous-dependencies */
import { eventChannel, END, buffers, delay, channel } from 'redux-saga';
/* eslint-enable import/no-extraneous-dependencies */
import ono from 'ono';

// todo: remove workaround for https://github.com/JS-DevTools/ono/issues/8
export const IS_SOCKET_ERROR = '__symbol-socket-error';
const wrapSocketError = error =>
  ono(error, { [IS_SOCKET_ERROR]: true }, 'Socket error');

const socketError = (message, info) =>
  ono({ [IS_SOCKET_ERROR]: true, info }, message);

function watchMessages(socket) {
  return eventChannel((emit) => {
    function onMessage({ data }) {
      try {
        emit(JSON.parse(data));
      } catch (e) {
        /* eslint-disable no-use-before-define */
        removeListeners();
        /* eslint-enable no-use-before-define */
        emit(wrapSocketError(e));
        emit(END);
      }
    }

    function onClose(event) {
      /* eslint-disable no-use-before-define */
      removeListeners();
      /* eslint-enable no-use-before-define */
      emit(socketError(`Unexpected ${event.type}`, event));
      emit(END);
    }

    socket.addEventListener('message', onMessage);
    socket.addEventListener('close', onClose);
    socket.addEventListener('error', onClose);

    function removeListeners() {
      socket.removeEventListener('message', onMessage);
      socket.removeEventListener('close', onClose);
      socket.removeEventListener('error', onClose);
    }
    return removeListeners;
  }, buffers.expanding());
}

function openSocket(url) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    function removeListeners() {
      /* eslint-disable no-use-before-define */
      socket.removeEventListener('open', onOpen);
      socket.removeEventListener('error', onError);
      socket.removeEventListener('close', onClose);
      /* eslint-enable no-use-before-define */
    }
    function onOpen() {
      removeListeners();
      resolve(socket);
    }

    function onClose(event) {
      removeListeners();
      reject(socketError('Socket closed on connect', event));
    }

    function onError(event) {
      removeListeners();
      reject(socketError('Socket error on connect', event));
    }

    socket.addEventListener('open', onOpen);
    socket.addEventListener('error', onError);
    socket.addEventListener('close', onClose);
  });
}

const PROMISE_NEVER = new Promise(Function.prototype);
function* timeoutError(timeout) {
  yield delay(timeout);
  throw socketError('Socket timed out');
}

function* watchdog(heartbeatChannel, heartbeatTimeout) {
  while (true) {
    const timeout = yield fork(timeoutError, heartbeatTimeout);
    yield take(heartbeatChannel);
    yield cancel(timeout);
  }
}

function* errorOnly(socketEmitter, send, socket) {
  yield call(socketEmitter, send, socket);
  yield PROMISE_NEVER;
}

export default ({
  socketListener = () => PROMISE_NEVER,
  socketEmitter = () => PROMISE_NEVER,
  url,
  heartbeatTimeout = 2000,
}) =>
  function* socketSaga() {
    const [socket] = yield race([openSocket(url), timeoutError(2000)]);
    const socketChannel = yield call(watchMessages, socket);
    const send = (data) => {
      const json = JSON.stringify(data);
      try {
        socket.send(json);
      } catch (e) {
        throw wrapSocketError(e);
      }
    };
    const heartbeatChannel = channel();
    function* sendHeartbeat() {
      yield put(heartbeatChannel, false);
    }
    try {
      yield race({
        external: call(socketListener, socketChannel, sendHeartbeat),
        internal: call(errorOnly, socketEmitter, send, socket),
        watchdog: call(watchdog, heartbeatChannel, heartbeatTimeout),
      });
    } finally {
      socketChannel.close();
      socket.close();
      heartbeatChannel.close();
    }
  };
