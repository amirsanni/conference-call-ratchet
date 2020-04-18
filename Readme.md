# Conference Call
A conference call implementation using WebRTC, [Ratchet Web Socket](https://github.com/ratchetphp/Ratchet).


# Getting Started
- Run `composer install` to install the dependencies.
- Set your web socket domain name and port in `ws/bin/server.php`
- Update your websocket URL (`wsUrl`) in `assets/js/chat.js`


# Features
- Multi-participants
- Toggling of video stream
- Toggling of audio stream (mute & unmute)
- Screen sharing
- Text chat
- Mute individual participant
- Expand participants' stream
- Screen Recording
- Video Recording


# Note
The app uses xirsys free ice servers which you can get by creating a free xirsys account. If you opt for that, ensure you rename the `Server.example.php` in the root directory to `Server.php` and replace the dummy credentials there with yours.


# Alternative
If you prefer to use socket.io and NodeJS instead of PHP Web socket (Ratchet), check out the NodeJS version [here](https://github.com/amirsanni/Video-Call-App-NodeJS).
