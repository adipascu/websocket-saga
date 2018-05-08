import { take, call, race, fork, cancel } from 'redux-saga/effects';
/* eslint-disable import/no-extraneous-dependencies */
import { eventChannel, END, buffers, delay } from 'redux-saga';
/* eslint-enable import/no-extraneous-dependencies */

function watchMessages(socket, logger) {
  return eventChannel((emit) => {
    function onMessage({ data }) {
      try {
        emit(JSON.parse(data));
      } catch (e) {
        logger.error(`invalid message ${data}`);
        /* eslint-disable  no-use-before-define */
        onEnd();
        /* eslint-enable  no-use-before-define */
      }
    }
    function onEnd() {
      emit(END);
      socket.removeEventListener('message', onMessage);
      socket.removeEventListener('close', onEnd);
      socket.removeEventListener('error', onEnd);
    }

    socket.addEventListener('message', onMessage);
    socket.addEventListener('close', onEnd);
    socket.addEventListener('error', onEnd);

    return () => {
      socket.close();
    };
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
      reject(event);
    }

    function onError(event) {
      removeListeners();
      reject(event);
    }


    socket.addEventListener('open', onOpen);
    socket.addEventListener('error', onError);
    socket.addEventListener('close', onClose);
  });
}


const NO_OP = () => new Promise(Function.prototype);
function* timeoutError(timeout) {
  yield delay(timeout);
  throw new Error('socket timed out');
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
  yield call(NO_OP);
}

export default ({
  socketListener = NO_OP,
  socketEmitter = NO_OP,
  onDisconnected = null,
  url,
  logger = console,
  heartbeatTimeout = 2000,
}) => function* socketSaga() {
  while (true) {
    try {
      const socket = yield openSocket(url);
      const send = (data) => {
        const json = JSON.stringify(data);
        try {
          socket.send(json);
        } catch (e) {
          logger.error('can not send data', e);
        }
      };
      const socketChannel = yield call(watchMessages, socket, logger);
      const data = { heartbeat: Function.prototype };
      const heartbeatChannel = eventChannel((emit) => {
        data.heartbeat = () => emit(false);
        return Function.prototype;
      });

      try {
        yield race({
          external: call(socketListener, socketChannel, data.heartbeat),
          internal: call(errorOnly, socketEmitter, send, socket),
          watchdog: call(watchdog, heartbeatChannel, heartbeatTimeout),
        });
      } finally {
        if (onDisconnected !== null) {
          yield call(onDisconnected);
        }
        socketChannel.close();
      }
    } catch (e) {
      logger.error('Socket error', e);
    }
    yield delay(2000);
  }
};
