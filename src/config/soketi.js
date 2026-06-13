import Pusher from "pusher";

const pusher = new Pusher({
  appId: process.env.SOKETI_DEFAULT_APP_ID,
  key: process.env.SOKETI_DEFAULT_APP_KEY,
  secret: process.env.SOKETI_DEFAULT_APP_SECRET,
  host: process.env.SOKETI_DEFAULT_HOST,
  port: 443,
  useTLS: true,
});

export default pusher;
