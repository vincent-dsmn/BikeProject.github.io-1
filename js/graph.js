window.AudioContext = window.AudioContext || window.webkitAudioContext;

var audioContext = null;
var isPlaying = false;
var sourceNode = null;
var analyser = null;
var theBuffer = null;
var mediaStreamSource = null;
var detectorElem, 
	canvasElem,
	waveCanvas,
	noteElem
var Liste_Freq = [];
var Compteur = 0;

window.onload = function() {
	audioContext = new AudioContext();
	MAX_SIZE = Math.max(4,Math.floor(audioContext.sampleRate/5000));	// corresponds to a 5kHz signal

	detectorElem = document.getElementById( "detector" );
	canvasElem = document.getElementById( "output" );
	noteElem = document.getElementById( "note" );

}

function startPitchDetect() {
			// grab an audio context
			audioContext = new AudioContext();

			// Attempt to get audio input
			navigator.mediaDevices.getUserMedia({"audio": "true"}).then((stream) => {
				// Create an AudioNode from the stream.
				mediaStreamSource = audioContext.createMediaStreamSource(stream);

				// Connect it to the destination.
				analyser = audioContext.createAnalyser();
				analyser.fftSize = 2048;
				mediaStreamSource.connect( analyser );
				updatePitch();

			}).catch((err) => {
				// always check for errors at the end.
				console.error(`${err.name}: ${err.message}`);
				alert("Vous devez activer votre microphone pour utiliser cette fonctionnalité.");
			});
}


function stopListening() {
	sourceNode = audioContext.createBufferSource();
    sourceNode.buffer = theBuffer;
    sourceNode.loop = true;
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    sourceNode.connect( analyser );
    analyser.connect( audioContext.destination );
    sourceNode.start( 0 );
    isPlaying = true;
    isLiveInput = false;

    if (isPlaying) {
        //stop playing and return
        sourceNode.stop( 0 );
        sourceNode = null;
        analyser = null;
        isPlaying = false;
		noteElem.innerText = "--";
		
		if (!window.cancelAnimationFrame)
			window.cancelAnimationFrame = window.webkitCancelAnimationFrame;
        window.cancelAnimationFrame( rafID );

        return "Stop";
    }
}


var rafID = null;
var tracks = null;
var buflen = 2048;
var buf = new Float32Array( buflen );



function autoCorrelate( buf, sampleRate ) {
	// Implements the ACF2+ algorithm
	var SIZE = buf.length;
	var rms = 0;

	for (var i=0;i<SIZE;i++) {
		var val = buf[i];
		rms += val*val;
	}
	rms = Math.sqrt(rms/SIZE);
	if (rms<0.01) // not enough signal
		return -1;

	var r1=0, r2=SIZE-1, thres=0.2;
	for (var i=0; i<SIZE/2; i++)
		if (Math.abs(buf[i])<thres) { r1=i; break; }
	for (var i=1; i<SIZE/2; i++)
		if (Math.abs(buf[SIZE-i])<thres) { r2=SIZE-i; break; }

	buf = buf.slice(r1,r2);
	SIZE = buf.length;

	var c = new Array(SIZE).fill(0);
	for (var i=0; i<SIZE; i++)
		for (var j=0; j<SIZE-i; j++)
			c[i] = c[i] + buf[j]*buf[j+i];

	var d=0; while (c[d]>c[d+1]) d++;
	var maxval=-1, maxpos=-1;
	for (var i=d; i<SIZE; i++) {
		if (c[i] > maxval) {
			maxval = c[i];
			maxpos = i;
		}
	}
	var T0 = maxpos;

	var x1=c[T0-1], x2=c[T0], x3=c[T0+1];
	a = (x1 + x3 - 2*x2)/2;
	b = (x3 - x1)/2;
	if (a) T0 = T0 - b/(2*a);

	return sampleRate/T0;
}



function updatePitch( time ) {
	analyser.getFloatTimeDomainData( buf );
	var ac = autoCorrelate( buf, audioContext.sampleRate );

 	if (ac == -1) {
 		detectorElem.className = "vague";
		noteElem.innerText = "--";
 	} 
	
	else {
	 	detectorElem.className = "confident";
	 	pitch = ac;
		if (pitch > 40 && pitch < 1000){
	 		noteElem.innerText = Math.round( pitch )+ " Hz";
			 Liste_Freq.push([((Liste_Freq.length)/60).toFixed(2), Math.round( pitch )]);

		}
		
		if (Liste_Freq.length > document.getElementById("Duree").value*60) { //60 pour 1s
			stopListening();
			createGraph();
		}
		
	}

	if (!window.requestAnimationFrame)
		window.requestAnimationFrame = window.webkitRequestAnimationFrame;
	rafID = window.requestAnimationFrame( updatePitch );
}


//Function that create a div automatically for each graph and add it
function createGraph(){
	var div = document.createElement("div");
	div.id = "Graph"+Compteur;
	//Change CSS of div.id to copy the Graph div css
	div.style = "width: 500px; height: 400px; margin: 0 auto; background-color: #fff; border: 1px solid #ccc; border-radius: 3px; padding: 10px; margin-bottom: 10px; margin-top: 30px;";
	div.style.paddingBottom = 1.5+"em";
	//Ajouter un texte à div.id en UTF-8 avec la moyenne de la fréquence en utilisant averageGraph()
	div.innerText = "Moyenne de la fréquence : "+smart_average().toFixed(2)+" Hz";
	document.body.appendChild(div);
	anychart.onDocumentReady(function () {

		var data = Liste_Freq;

		// create a data set
		var dataSet = anychart.data.set(data);

		// map the data for all series
		var firstSeriesData = dataSet.mapAs({x: 0, value: 1});

		// create a line chart
		var chart = anychart.line();

		// create the series and name them
		var firstSeries = chart.line(firstSeriesData);
		
		chart.title("Fréquence en fonction du temps");
		chart.xAxis().title("Temps (s)");
    	chart.yAxis().title("Fréquence (Hz)");
		
		// specify where to display the chart
		chart.container(div.id);
		chart.maxHeight(400);
		chart.maxWidth(500);

		//draw the chart in the Graph div
		chart.draw();
		Liste_Freq = [];


	});
	Compteur++;
}


function smart_average(){

	liste_des_frequences = []
	for(var i = 0; i < Liste_Freq.length; i++){
		liste_des_frequences.push(Liste_Freq[i][1]);
	}

	var freq = [] ;
	
	var liste_de_liste_freq = [];

	liste_des_frequences.sort();

	len=liste_des_frequences.length;

	for (var i=0;  i<len; i++) {
		for (var j=0; j<len; j++) {
			if (liste_des_frequences[j] >= liste_des_frequences[i]-5 && liste_des_frequences[j] <= liste_des_frequences[i]+5) {
				freq.push(liste_des_frequences[j]);
				}
		}
		liste_de_liste_freq.push(freq);
		freq = [];
	}

	var position = 0;
	len = liste_de_liste_freq.length;

	for (var i=0; i<len; i++) {
		if (liste_de_liste_freq[i].length > liste_de_liste_freq[position].length) 
			position = i;
	}

	var sum = 0;
	len = liste_de_liste_freq[position].length;

	for (var i=0; i<len; i++) {
		sum += liste_de_liste_freq[position][i];
	}

	var avg = sum / (liste_de_liste_freq[position]).length;

	return avg;
}

function ClearGraph(){
	//Clear/Delete all the divs
	for (var i = 0; i < Compteur; i++) {
		var div = document.getElementById("Graph"+i);
		div.parentNode.removeChild(div);
	}
	Compteur = 0;
}

