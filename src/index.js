/** INDEX.JS **/

import "./styles.scss";
import "babel-polyfill";

import * as tf from '@tensorflow/tfjs';
import * as tfvis from '@tensorflow/tfjs-vis';
import * as d3 from "d3";

import WebCam from './webcam';
import { deprocessImage } from "./filters";
import * as utils from "./utils";
import { AttributionGraph } from "./attribution-graph"

import * as imageNetClasses from "./imagenet_classes";
import {layerChannelCounts} from './layers';
import { internalActivations, ClassActivationMaps } from "./main.js"

const imageElem = document.querySelector('#image-container');
const videoElem = document.querySelector('.video-option');
const webcamBtn = document.querySelector('input[id="webcam-btn"]');
const webcamElement = document.getElementById('video');

const progressBar1 = document.querySelector('#progress-bar-1');
const progressBar2 = document.querySelector('#progress-bar-2');
const loaderBox = document.querySelector('.loader-box');

let model, tensor, mediaTensor;

function getProcessedTensor(media) {
    tensor = tf.browser.fromPixels(media);
    tensor = tensor.resizeNearestNeighbor([224, 224]).toFloat();

    // More pre-processing
    let meanImageNetRGB = {
        red: 123.68,
        green: 116.779,
        blue: 103.939
    };

    let indices = [
        tf.tensor1d([0], "int32"),
        tf.tensor1d([1], "int32"),
        tf.tensor1d([2], "int32")
    ];

    // Centering the RGB values
    let centeredRGB = {
        red: tf.gather(tensor, indices[0], 2)
            .sub(tf.scalar(meanImageNetRGB.red))
            .reshape([50176]),
        green: tf.gather(tensor, indices[1], 2)
            .sub(tf.scalar(meanImageNetRGB.green))
            .reshape([50176]),
        blue: tf.gather(tensor, indices[2], 2)
            .sub(tf.scalar(meanImageNetRGB.blue))
            .reshape([50176])
    };
    // Stacking, reversing, and reshaping
    let processedTensor = tf.stack([
        centeredRGB.red, centeredRGB.green, centeredRGB.blue
    ], 1)
        .reshape([224, 224, 3])
        .reverse(2)
        .expandDims();

    return processedTensor;
}

let top5, IMAGENET_CLASSES;
IMAGENET_CLASSES = imageNetClasses.IMAGENET_CLASSES

function showPredictions(predictions) {
    top5 = Array.from(predictions)
        .map(function (p, i) {
            return {
                probability: p,
                className: IMAGENET_CLASSES[i]
            };
        }).sort(function (a, b) {
            return b.probability - a.probability;
        }).slice(0, 5);

    var el = document.querySelector('#prediction-list');

    var children = el.children,
        len = children.length;

    for (var i = 0; i < len; i++) {
        const text = children[i].children[1].children;
        const prob = top5[i].probability.toFixed(6);
        children[i].children[0].setAttribute('style', 'width: ' + (Math.round(prob * 100)).toString() + '%');
        text[0].innerHTML = top5[i].className.split(',')[0]
        text[1].innerHTML = Math.floor(prob * 100) / 100;
    }
}

// Generate Internal Activations
async function getActivations() {
    console.log('Loading activations..')
    const activationsDiv = document.querySelector('#activations');
    progressBar2.classList.remove("hide");
    activationsDiv.innerHTML = '';
    if (model && tensor) {
        //await internalActivations(model, tensor, activationsDiv);
        //progressBar2.classList.add("hide");
    }
}

// Generate Activation map on input image
async function getActivationMaps() {
    console.log('Loading heatmap..');

    const camDiv = document.querySelector('#cam');

    const tensorData = mediaTensor || tensor;
    camDiv.innerHTML = '';
    if (model && tensorData) {
        await ClassActivationMaps(model, tensorData, top5, camDiv);
        loaderBox.classList.add("hide");
    }
    if (mediaTensor) mediaTensor.dispose();
    if (tensor) tensor.dispose();
    if (tensorData) tensorData.dispose();
}

// EVENT HANDLERS
function setupListeners() {

    document.querySelector("#model-selector")
        .addEventListener("change", () => {
            loadModel($("#model-selector").val());
    });

    document
    .querySelector("#image-selector")
    .addEventListener("change", loadImage);

    $('#predict-button').click(async function () {
        progressBar1.classList.remove("hide");
        let image = $('#image-container').get(0);
        //.expandDims();
        let processedTensor = await getProcessedTensor(image);
        let predictions = await model.predict(processedTensor).data();
        showPredictions(predictions);
        progressBar1.classList.add("hide");

        processedTensor.dispose();
    });

    document.querySelector("#show-metrics")
        .addEventListener("click", showModel);

    //document
      //  .querySelector("#activation-btn")
        //.addEventListener("click", getActivations);

    document
        .querySelector("#heatmap-btn")
        .addEventListener("click", async function () {
            loaderBox.classList.remove("hide");
            setTimeout(() => {
                getActivationMaps();
            }, 500);
    });

    $('#activ-btn').click(async () => {
        let image = $('#image-container').get(0);
        ActivationGraph(image);
    })

    $('#graph-btn').click(async () => {
        let image = $('#image-container').get(0);
        AttributionGraph();
        setTimeout(() => {
            FeatureMaps(image);
        }, 500)
    })

    webcamBtn.addEventListener("click", videoOption);

    document.getElementById('capture')
        .addEventListener('click', () => {
            const canvas = document.getElementById('webcam-frame');
            const context = canvas.getContext('2d');
            // Draw the video frame to the canvas.
            context.drawImage(webcamElement, 0, 0, canvas.width, canvas.height);
        });
}

document.addEventListener("DOMContentLoaded", () => {
    setupListeners();
    run();
});

async function run() { }

async function loadModel(name) {
    console.log(name)
    progressBar1.classList.remove("hide");
    model = undefined;
    model = await tf.loadLayersModel(`./tfjs-models/${name}/model.json`);
    progressBar1.classList.add("hide");
}

async function loadImage(res) {
    let reader = new FileReader();
    reader.onload = function () {
        let dataURL = reader.result;
        imageElem.setAttribute("src", dataURL);
    };
    let file = $("#image-selector").prop("files")[0];
    reader.readAsDataURL(file);
}

async function showModel() {
    const visorInstance = tfvis.visor();
    if (!visorInstance.isOpen()) {
        visorInstance.toggle();
    }
    const surface = {
        name: 'Model Summary',
        tab: 'Model'
    };
    tfvis.show.modelSummary(surface, model);
}

async function videoOption() {
    imageElem.classList.add('hide');
    videoElem.classList.remove('hide');

    if (this.checked) {
        const webcam = new WebCam();
        await webcam.setupWebcam(webcamElement);

        while (true) {
            let mediaTensor = getProcessedTensor(webcamElement);
            let predictions = await model.predict(mediaTensor).data();
            showPredictions(predictions);
            await tf.nextFrame();
        }
    } else {
        videoElem.classList.add('hide');
        imageElem.classList.remove('hide');
    }
}

async function testVis() {
    // Get a surface
    const surface = tfvis.visor().surface({
        name: 'Surface',
        tab: 'Image from Tensor'
    });
    const drawArea = surface.drawArea;

    const canvas = document.createElement('canvas');
    canvas.getContext('2d');
    canvas.width = origTensor[0];
    canvas.height = origTensor[1];
    canvas.style = 'margin: 4px;';
    await tf.browser.toPixels(origTensor, canvas);
    drawArea.appendChild(canvas);
}

async function AttributionMatrix(img_tensor) {

    const layerNames = []
    model.layers.map(layerName => {
        if (layerName.name.startsWith('block', 0))
            layerNames.push(layerName.name);
    });

    const layerOutputs = layerNames.map(layerName => model.getLayer(layerName).output);
    const activation_model = tf.model({ inputs: model.input, outputs: layerOutputs });
    const activations = await activation_model.predict(img_tensor);

    let matrix = [];
    for (let i = 0; i < activations.length - 1; ++i) {
        const layerName = layerNames[i];
        let activationTensors = tf.split(activations[i], activations[i].shape[activations[i].shape.length - 1], -1);

        const layerWise = [];
        for (let j = 0; j < activationTensors.length - 1; ++j) {
            const imgs_acts_max = activationTensors[j].max([1, 2]);
            console.log(imgs_acts_max.shape)
            for (let k=0; k<imgs_acts_max.shape[0]; k++) {
                const top_channels = [];
                
                const working_acts_max = imgs_acts_max[k] / tf.sum(imgs_acts_max[k]);
                console.log("working_acts_max")
            } 
        }
    }

}

async function FeatureMaps(image) {
    const dagSVG = d3.select('#dag');
    const dagG = dagSVG.selectAll("#dagG");
    
    const img_tensor = await getProcessedTensor(image);
    let layers = Object.keys(layerChannelCounts).reverse();

    const layerOutputs = layers.map(layerName => model.getLayer(layerName).output);
    const activation_model = tf.model({ inputs: model.input, outputs: layerOutputs });
    const activations = activation_model.predict(img_tensor);

    for (let i = 0; i < 8; ++i) {
        const layerName = layers[i];

        const activationTensors = tf.split(activations[i], activations[i].shape[activations[i].shape.length - 1], -1);
        dagG.selectAll('.fv-ch-' + layerName)
        .each( async function(d, j) {
            
            const container = d3.select(this).node();
            var xhtmlNS = "http://www.w3.org/1999/xhtml";
            var context = container.getElementsByTagNameNS(xhtmlNS,'canvas')[0].getContext('2d');
            context.fillStyle = 'rgba(0,200,0,0.7)';
            context.fillRect(0,0,100,75);
            
            let imageTensor = tf.tidy(() => deprocessImage(activationTensors[j]));
            imageTensor = utils.applyColorMap(imageTensor);
            imageTensor = imageTensor.reshape([imageTensor.shape[1], imageTensor.shape[2], imageTensor.shape[3]]);

            const canvas = document.createElement("canvas");
            canvas.getContext("2d");
            canvas.width = imageTensor[0];
            canvas.height = imageTensor[1];
            await tf.browser.toPixels(imageTensor, canvas);
            
            //container.append(canvas);
            //grab the context from your destination canvas
            //var destCtx = destinationCanvas.getContext('2d');

            //call its drawImage() function passing it the source canvas directly
            context.drawImage(canvas, 0, 0);

            imageTensor.dispose();
            
        })

        tf.dispose(activationTensors);
        
    }
}

async function ActivationGraph(image) {

    const img_tensor = await getProcessedTensor(image);
    const layerNames = []
    model.layers.map(layerName => {
        if (layerName.name.startsWith('block', 0))
            layerNames.push(layerName.name);
    });

    const layerOutputs = layerNames.map(layerName => model.getLayer(layerName).output);
    const activation_model = tf.model({ inputs: model.input, outputs: layerOutputs });
    const activations = activation_model.predict(img_tensor);

    const surface = tfvis.visor().surface({
        name: "Surface",
        tab: 'layerName'
    });
    const drawArea = surface.drawArea;
    
    // LAYER ACTIVATION FLATTENED
    for (let i = 0; i < activations.length - 1; ++i) {
        const layerName = layerNames[i];

        let compression = activations[i];
        
        compression = compression.reshape([compression.shape[1], compression.shape[2], compression.shape[3]])
        compression = compression.mean(-1);
        
        
        let imageTensor = tf.tidy(() => deprocessImage(compression));

        compression = compression.reshape([1, compression.shape[0], compression.shape[1], 1]);
        
        imageTensor = utils.applyColorMap(compression); 
        imageTensor = imageTensor.reshape([imageTensor.shape[1], imageTensor.shape[2], imageTensor.shape[3]]);


        const canvas = document.createElement("canvas");
        canvas.getContext("2d");
        canvas.width = imageTensor[0];
        canvas.height = imageTensor[1];
        canvas.style = "margin: 2px;";
        await tf.browser.toPixels(imageTensor, canvas);
        drawArea.appendChild(canvas);

        imageTensor.dispose();  

        /*
        // FULL CHANNELS
        const activationTensors = tf.split(activations[i], activations[i].shape[activations[i].shape.length - 1], -1);
        const actualNumFilters = 8

        for (let j = 0; j < actualNumFilters; ++j) {
            
            let imageTensor = tf.tidy(() => deprocessImage(activationTensors[j]));
            imageTensor = utils.applyColorMap(imageTensor);
            imageTensor = imageTensor.reshape([imageTensor.shape[1], imageTensor.shape[2], imageTensor.shape[3]]);

            const canvas = document.createElement("canvas");
            canvas.getContext("2d");
            canvas.width = imageTensor[0];
            canvas.height = imageTensor[1];
            canvas.style = "margin: 2px;";
            await tf.browser.toPixels(imageTensor, canvas);
            drawArea.appendChild(canvas);

            imageTensor.dispose();
        }

        tf.dispose(activationTensors);
        */

    }

    tf.dispose(activations)
    img_tensor.dispose();
}
