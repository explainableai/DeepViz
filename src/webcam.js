class WebCam {

    constructor(){
    }

    async setupWebcam(webcamElement) {

      var constraints = { audio: true, video: true }
      let mediaStream = null;
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
        /* use the stream */
      } catch(err) {
        /* handle the error */
      }

      return new Promise((resolve, reject) => {
        const navigatorAny = navigator;
        navigator.getUserMedia = navigator.getUserMedia ||
            navigatorAny.webkitGetUserMedia || navigatorAny.mozGetUserMedia ||
            navigatorAny.msGetUserMedia;
        
        if (navigator.getUserMedia) {
          navigator.getUserMedia({video: true},
            stream => {
              webcamElement.srcObject = stream;
              webcamElement.addEventListener('loadeddata',  () => resolve(), false);
            },
            error => reject());
            
        } else {
          reject();
        }
        
      });
      }
}

export default WebCam;

