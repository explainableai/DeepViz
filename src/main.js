/**
 * Based on
 * https://github.com/fchollet/deep-learning-with-python-notebooks/blob/master/5.4-visualizing-what-convnets-learn.ipynb
 */

 import * as tf from "@tensorflow/tfjs";
 import {writeInternalActivationAndGetOutput} from "./filters";
 import * as utils from "./utils";

 import * as cam from "./cam";
 /**
 * Calcuate and update the maximally-activating input images for a covn2d layer.
 */

 const CONFIG = {
     layerNames: "block1_conv1,block2_conv1,block3_conv2,block4_conv2,block5_conv3",
     filters: 8,
     inputImage: "",
     outputDir: "activation"
 }

export async function internalActivations(model, inputTensor, activationsDiv) {

    const imageHeight = model.inputs[0].shape[1];
    const imageWidth = model.inputs[0].shape[2];
    const { filters, outputDir } = CONFIG;

    let x = inputTensor.resizeNearestNeighbor([imageHeight, imageWidth]);
    x = x.reshape([1, x.shape[0], x.shape[1], x.shape[2]]);
    //x = x.as4D([1, x.shape.length[0], x.shape.length[1], x.shape.length[2]]);
    const layerNames = CONFIG.layerNames.split(',');

    await writeInternalActivationAndGetOutput(
        model, layerNames, x, filters, outputDir, activationsDiv);
 }

 export async function ClassActivationMaps(model, inputTensor, indices, camDiv) {

    // Compute the internal activations of the conv layers' outputs.
    const imageHeight = model.inputs[0].shape[1];
    const imageWidth = model.inputs[0].shape[2];
    let x = inputTensor.resizeNearestNeighbor([imageHeight, imageWidth]);
    x = x.reshape([1, x.shape[0], x.shape[1], x.shape[2]]);

    var container = document.createElement("div");
        container.classList.add('class-activation-map');
        camDiv.appendChild(container);

    // Calculate the sensitivity
    var t0 = performance.now();
    const xWithCAMOverlay = cam.ClassActivationMap(model, indices[0], x);
    var t1 = performance.now();
    //console.log("ClassActivationMap: " + (t1 - t0) / 1000 + " sec.");

    var t2 = performance.now();
    await utils.writeImageTensorToFile(xWithCAMOverlay, container);
    var t3 = performance.now();
    //console.log("writeImageTensorToFile: " + (t3 - t2) / 1000 + " sec.");
 }