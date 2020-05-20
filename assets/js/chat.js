/**
 * @author Amir Sanni <amirsanni@gmail.com>
 * @date 6th January, 2020
 */
import h from './helpers.js';

const wsUrl = 'ws://localhost:8080';
var servers = {
    iceServers: []
}

window.addEventListener('load', ()=>{
    const room = h.getQString(location.href, 'room');
    const username = sessionStorage.getItem('username');
    
    h.getIceServer().then((ice)=>{
        servers.iceServers = [ice];
        console.log(ice);
    }).catch((e)=>{
        console.error(e);
    });

    if(!room){
        document.querySelector('#room-create').attributes.removeNamedItem('hidden');
    }

    else if(!username){
        document.querySelector('#username-set').attributes.removeNamedItem('hidden');
    }

    else{
        let commElem = document.getElementsByClassName('room-comm');

        for(let i = 0; i < commElem.length; i++){
            commElem[i].attributes.removeNamedItem('hidden');
        }

        var socketId = username+'__'+h.generateRandomString();
        var pc = [];

        let socket = new WebSocket(`${wsUrl}/comm`);
        
        var myStream =  '';
        var screen = '';
        var recordedStream = [];
        var mediaRecorder = '';

        //Get user video by default
        getAndSetUserStream();

        socket.onopen = ()=>{
            //subscribe to room
            socket.send(JSON.stringify({
                action: 'subscribe',
                room: room,
                sender: socketId
            }));
        };


        socket.onerror = ()=>{
            console.error("Unable to connect to the chat server!");
        };


        socket.onmessage = async (e)=>{
            var data = JSON.parse(e.data);
            
            if(data.room && (data.room == room)){
                switch(data.action){
                    case 'newSub':
                        socket.send(JSON.stringify({
                            action: 'newUserStart',
                            to:data.socketId, 
                            sender:socketId,
                            room: room
                        }));

                        pc.push(data.socketId);
                        init(true, data.socketId);

                    break;

                    case 'newUserStart':
                        if(data.to == socketId){
                            pc.push(data.sender);
                            init(false, data.sender);
                        }
                    break;

                    case 'ice candidates':
                        //message is iceCandidate
                        if(data.to == socketId){
                            data.candidate ? await pc[data.sender].addIceCandidate(new RTCIceCandidate(data.candidate)) : '';
                        }
                        
                    break;

                    case 'sdp':
                        //message is signal description
                        console.log(data.description.type);
                        if(data.to == socketId){
                            if(data.description.type === 'offer'){
                                data.description ? await pc[data.sender].setRemoteDescription(new RTCSessionDescription(data.description)) : '';
            
                                h.getUserFullMedia().then(async(stream)=>{
                                    if(!document.getElementById('local').srcObject){
                                        h.setLocalStream(stream);
                                    }
            
                                    //save my stream
                                    myStream = stream;
            
                                    stream.getTracks().forEach((track)=>{
                                        pc[data.sender].addTrack(track, stream);
                                    });
            
                                    let answer = await pc[data.sender].createAnswer();
                                    
                                    await pc[data.sender].setLocalDescription(answer);
            
                                    socket.send(JSON.stringify({
                                        action: 'sdp',
                                        description:pc[data.sender].localDescription, 
                                        to:data.sender, 
                                        sender:socketId,
                                        room: room
                                    }));
                                }).catch((e)=>{
                                    console.error(e);
                                });
                            }
            
                            else if(data.description.type === 'answer'){
                                await pc[data.sender].setRemoteDescription(new RTCSessionDescription(data.description));
                            }
                        }
                        
                    break;

                    case 'chat':
                        //it is a text chat
                        h.addChat(data, 'remote');
                        
                    break;


                    case 'imOffline':
                        //remove video
                        h.closeVideo(data.sender);
                    break;
                }
            }
        };


        function getAndSetUserStream(){
            h.getUserFullMedia().then((stream)=>{
                //save my stream
                myStream = stream;
    
                h.setLocalStream(stream);
            }).catch((e)=>{
                console.error(`stream error: ${e}`);
            });
        }


        function sendMsg(msg){
            let data = {
                room: room,
                msg: msg,
                sender: username,
                action: 'chat'
            };

            //emit chat message
            socket.send(JSON.stringify(data));


            //add localchat
            h.addChat(data, 'local');
        }



        function init(createOffer, partnerName){
            pc[partnerName] = new RTCPeerConnection(servers);
            
            if(screen && screen.getTracks().length){
                screen.getTracks().forEach((track)=>{
                    pc[partnerName].addTrack(track, screen);//should trigger negotiationneeded event
                });
            }

            else if(myStream){
                myStream.getTracks().forEach((track)=>{
                    pc[partnerName].addTrack(track, myStream);//should trigger negotiationneeded event
                });
            }

            else{
                h.getUserFullMedia().then((stream)=>{
                    //save my stream
                    myStream = stream;
    
                    stream.getTracks().forEach((track)=>{
                        pc[partnerName].addTrack(track, stream);//should trigger negotiationneeded event
                    });
    
                    h.setLocalStream(stream);
                }).catch((e)=>{
                    console.error(`stream error: ${e}`);
                });
            }



            //create offer
            if(createOffer){
                pc[partnerName].onnegotiationneeded = async ()=>{
                    let offer = await pc[partnerName].createOffer();
                    
                    await pc[partnerName].setLocalDescription(offer);

                    socket.send(JSON.stringify({
                        action: 'sdp',
                        description:pc[partnerName].localDescription, 
                        to:partnerName, 
                        sender:socketId,
                        room: room
                    }));
                };
            }



            //send ice candidate to partnerNames
            pc[partnerName].onicecandidate = ({candidate})=>{
                socket.send(JSON.stringify({
                    action: 'ice candidates',
                    candidate: candidate, 
                    to:partnerName,
                    sender:socketId,
                    room: room
                }));
            };



            //add
            pc[partnerName].ontrack = (e)=>{console.log(e);
                let str = e.streams[0];
                if(document.getElementById(`${partnerName}-video`)){
                    document.getElementById(`${partnerName}-video`).srcObject = str;
                }

                else{
                    //video elem
                    let newVid = document.createElement('video');
                    newVid.id = `${partnerName}-video`;            
                    newVid.srcObject = str;
                    newVid.autoplay = true;
                    newVid.className = 'remote-video';

                    //video controls elements
                    let controlDiv = document.createElement('div');
                    controlDiv.className = 'remote-video-controls';
                    controlDiv.innerHTML = `<i class="fa fa-microphone text-white pr-3 mute-remote-mic" title="Mute"></i>
                        <i class="fa fa-expand text-white expand-remote-video" title="Expand"></i>`;
                    
                    //create a new div for card
                    let cardDiv = document.createElement('div');
                    cardDiv.className = 'card card-sm';
                    cardDiv.id = partnerName;
                    cardDiv.appendChild(newVid);
                    cardDiv.appendChild(controlDiv);
                    
                    //put div in main-section elem
                    document.getElementById('videos').appendChild(cardDiv);

                    h.adjustVideoElemSize();
                }
            };



            pc[partnerName].onconnectionstatechange = (d)=>{console.log(d);
                switch(pc[partnerName].iceConnectionState){
                    case 'disconnected':
                    case 'failed':
                        h.closeVideo(partnerName);
                        break;
                        
                    case 'closed':
                        h.closeVideo(partnerName);
                        break;
                }
            };



            pc[partnerName].onsignalingstatechange = (d)=>{console.log(d);
                switch(pc[partnerName].signalingState){
                    case 'closed':
                        console.log("Signalling state is 'closed'");
                        h.closeVideo(partnerName);
                        break;
                }
            };
        }



        function shareScreen(){
            h.shareScreen().then((stream)=>{
                h.toggleShareIcons(true);

                //disable the video toggle btns while sharing screen. This is to ensure clicking on the btn does not interfere with the screen sharing
                //It will be enabled was user stopped sharing screen
                h.toggleVideoBtnDisabled(true);

                //save my screen stream
                screen = stream;

                //share the new stream with all partners
                broadcastNewTracks(stream, 'video', false);

                //When the stop sharing button shown by the browser is clicked
                screen.getVideoTracks()[0].addEventListener('ended', ()=>{
                    stopSharingScreen();
                });
            }).catch((e)=>{
                console.error(e);
            });
        }



        function stopSharingScreen(){
            //enable video toggle btn
            h.toggleVideoBtnDisabled(false);

            return new Promise((res, rej)=>{
                screen.getTracks().length ? screen.getTracks().forEach(track => track.stop()) : '';

                res();
            }).then(()=>{
                h.toggleShareIcons(false);
                broadcastNewTracks(myStream, 'video');
            }).catch((e)=>{
                console.error(e);
            });
        }



        function broadcastNewTracks(stream, type, mirrorMode=true){
            h.setLocalStream(stream, mirrorMode);

            let track = type == 'audio' ? stream.getAudioTracks()[0] : stream.getVideoTracks()[0];

            for(let p in pc){
                let pName = pc[p];
                
                if(typeof pc[pName] == 'object'){
                    h.replaceTrack(track, pc[pName]);
                }
            }
        }


        function toggleRecordingIcons(isRecording){
            let e = document.getElementById('record');

            if(isRecording){
                e.setAttribute('title', 'Stop recording');
                e.children[0].classList.add('text-danger');
                e.children[0].classList.remove('text-white');
            }

            else{
                e.setAttribute('title', 'Record');
                e.children[0].classList.add('text-white');
                e.children[0].classList.remove('text-danger');
            }
        }


        function startRecording(stream){
            mediaRecorder = new MediaRecorder(stream, {
                mimeType: 'video/webm;codecs=vp9'
            });

            mediaRecorder.start(1000);
            toggleRecordingIcons(true);

            mediaRecorder.ondataavailable = (e)=>{
                recordedStream.push(e.data);
            }

            mediaRecorder.onstop = ()=>{
                toggleRecordingIcons(false);

                h.saveRecordedStream(recordedStream, username);

                setTimeout(()=>{
                    recordedStream = [];
                }, 3000);
            }

            mediaRecorder.onerror = (e)=>{
                console.error(e);
            }
        }


        //Chat textarea
        document.getElementById('chat-input').addEventListener('keypress', (e)=>{
            if(e.which === 13 && (e.target.value.trim())){
                e.preventDefault();
                
                sendMsg(e.target.value);

                setTimeout(()=>{
                    e.target.value = '';
                }, 50);
            }
        });


        //When the video icon is clicked
        document.getElementById('toggle-video').addEventListener('click', (e)=>{
            e.preventDefault();

            let elem = document.getElementById('toggle-video');
            
            if(myStream.getVideoTracks()[0].enabled){
                e.target.classList.remove('fa-video');
                e.target.classList.add('fa-video-slash');
                elem.setAttribute('title', 'Show Video');

                myStream.getVideoTracks()[0].enabled = false;
            }

            else{
                e.target.classList.remove('fa-video-slash');
                e.target.classList.add('fa-video');
                elem.setAttribute('title', 'Hide Video');

                myStream.getVideoTracks()[0].enabled = true;
            }

            broadcastNewTracks(myStream, 'video');
        });


        //When the mute icon is clicked
        document.getElementById('toggle-mute').addEventListener('click', (e)=>{
            e.preventDefault();

            let elem = document.getElementById('toggle-mute');
            
            if(myStream.getAudioTracks()[0].enabled){
                e.target.classList.remove('fa-microphone-alt');
                e.target.classList.add('fa-microphone-alt-slash');
                elem.setAttribute('title', 'Unmute');

                myStream.getAudioTracks()[0].enabled = false;
            }

            else{
                e.target.classList.remove('fa-microphone-alt-slash');
                e.target.classList.add('fa-microphone-alt');
                elem.setAttribute('title', 'Mute');

                myStream.getAudioTracks()[0].enabled = true;
            }

            broadcastNewTracks(myStream, 'audio');
        });


        //When user clicks the 'Share screen' button
        document.getElementById('share-screen').addEventListener('click', (e)=>{
            e.preventDefault();

            if(screen && screen.getVideoTracks().length && screen.getVideoTracks()[0].readyState != 'ended'){
                stopSharingScreen();
            }

            else{
                shareScreen();
            }
        });


        //When record button is clicked
        document.getElementById('record').addEventListener('click', (e)=>{
            /**
             * Ask user what they want to record.
             * Get the stream based on selection and start recording
             */
            if(!mediaRecorder || mediaRecorder.state == 'inactive'){
                h.toggleModal('recording-options-modal', true);
            }

            else if(mediaRecorder.state == 'paused'){
                mediaRecorder.resume();
            }

            else if(mediaRecorder.state == 'recording'){
                mediaRecorder.stop();
            }
        });


        //When user choose to record screen
        document.getElementById('record-screen').addEventListener('click', ()=>{
            h.toggleModal('recording-options-modal', false);

            if(screen && screen.getVideoTracks().length){
                startRecording(screen);
            }

            else{
                h.shareScreen().then((screenStream)=>{
                    startRecording(screenStream);
                }).catch(()=>{});
            }
        });


        //When user choose to record own video
        document.getElementById('record-video').addEventListener('click', ()=>{
            h.toggleModal('recording-options-modal', false);
            
            if(myStream && myStream.getTracks().length){
                startRecording(myStream);
            }

            else{
                h.getUserFullMedia().then((videoStream)=>{
                    startRecording(videoStream);
                }).catch(()=>{});
            }
        });
    }
});
