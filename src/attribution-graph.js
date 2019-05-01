import * as d3 from "d3";

import {layerChannelCounts, layerIndex, indexLayer} from './layers';

export function AttributionGraph() {
    // right
let rightInner = d3.select('#right').append('div').attr('id', 'right-inner')
let rightInnerDagWrapper = rightInner.append('div').attr('id', 'right-inner-dag-wrapper');
rightInner = d3.select('#right-inner')
rightInnerDagWrapper = d3.select('#right-inner-dag-wrapper')

// MAIN
dagVIS();

// global variable
let layers = Object.keys(layerChannelCounts).reverse()
let isAlreadyClicked = {}

const dagMargin = ({ top: 40, right: 40, bottom: 40, left: 40 })
const dagWidth = 1000 - dagMargin.left - dagMargin.right
const dagHeight = 800 - dagMargin.top - dagMargin.bottom // 790 based on laptop screen height
let k = 1; // dag zoom scale
const filterTransitionSpeed = 1000
const fv_type = '.jpg'

let zoom = d3.zoom()
    .scaleExtent([.1, 3.5])
    .extent([[0, 0], [dagWidth, dagHeight]])
    .on("zoom", zoomed);

function zoomed() {
    d3.select('#dagG').attr("transform", d3.event.transform);
    // console.log(d3.event.transform)
}

let dagSVG = rightInnerDagWrapper
    .append('svg')
    .attr('viewBox', '0 0 ' + (dagWidth + dagMargin.left + dagMargin.right) + ' ' + (dagHeight + dagMargin.top + dagMargin.bottom))
    .attr('width', '100%')
    .style('border-bottom', '1px solid rgba(0, 0, 0, 0.1)')
    .attr('id', 'dag')
    

dagSVG.append('filter')
    .attr('id', 'grayscale')
    .append('feColorMatrix')
    .attr('type', 'matrix')
    .attr('values', '0.3333 0.3333 0.3333 0 0 0.3333 0.3333 0.3333 0 0 0.3333 0.3333 0.3333 0 0 0 0 0 1 0')

dagSVG.append('filter')
    .attr('id', 'drop-shadow')
    .attr('y',"-50%")
    .attr('width', "200%")
    .attr('height', "200%")
    .append('feDropShadow')
    .attr('dx',"0")
    .attr('dy',"0")
    .attr('stdDeviation',"8")
    .attr('flood-color', "rgba(0, 0, 0, 0.6)")
    .attr('flood-opacity',"1")

let zoomRect = dagSVG.append("rect")
    .attr("width", dagWidth + dagMargin.left + dagMargin.right)
    .attr("height", dagHeight + dagMargin.top + dagMargin.bottom)
    .style("fill", "white")
    .style("pointer-events", "all")
    // .attr('transform', 'translate(' + dagMargin.left + ',' + dagMargin.top + ')')
    .call(zoom);

let dagDefs = dagSVG.append('defs')

const fvWidth = 100
const fvHeight = fvWidth

const deWidth = 49
const deHeight = deWidth

const attrFvWidth = 60
const attrFvHeight = attrFvWidth

let layerVerticalSpace = 300
let fvHorizontalSpace = 50

function dagVIS() {
    
    d3.json('ag-' + 270 + '.json').then(function (dag) {
        //console.log(dag);

        let tempMins = []
        let tempMaxs = []
        let tempCountMaxs = []
        layers.forEach(layer => {
            let tempExtent = d3.extent(dag[layer], d => {
                return d.pagerank
            })
            tempMins.push(tempExtent[0])
            tempMaxs.push(tempExtent[1])
            tempCountMaxs.push(d3.max(dag[layer], d => { return d.count }))
        })

        const fvScaleMax = d3.max(tempMaxs)
        const fvScaleMin = d3.min(tempMins)
        const cvScaleCountMax = d3.max(tempCountMaxs)

        let countMax = d3.max(dag)

        let fvScale = d3.scaleLinear()
            .domain([0, cvScaleCountMax]) // max = 1300 for all class comparison
            .range([fvWidth / 3, fvWidth])

        let dagG = dagSVG
            .append("g")
            .attr("transform", "translate(" + dagMargin.left + "," + dagMargin.top + ")")
            .attr('id', 'dagG')

        d3.select('#dag-channel-count-filter-slider')
            .attr('max', cvScaleCountMax)

        function centerDag() {
            zoomRect.transition().duration(750).call(zoom.transform, d3.zoomIdentity.translate(dagWidth / 2, 50).scale(0.5));
        }
        centerDag()
        d3.select('#dag-home').on('click', () => {
            centerDag()
        })

        function computeChannelCoordinates(layer) {
            let i = 0
            dag[layer].forEach(ch => {
                ch.width = fvScale(ch.count)
                ch.x = (((fvWidth + fvHorizontalSpace) * i) - ((dag[layer].length * fvWidth + (dag[layer].length - 1) * fvHorizontalSpace) / 2)) + (fvWidth - ch.width) / 2
                ch.y = layerIndex[layer] * layerVerticalSpace + (fvWidth - ch.width) / 2
                i = i + 1
            });

        }

        function initializeChannelEdgeCount(layer) {
            dag[layer].forEach(ch => {
                ch.numOfEdgesIn = 0
                ch.numOfEdgesOut = 3
            });

        }

        function drawChannels(layer) {
            dagG.selectAll('.fv-ch-' + layer)
                .data(dag[layer])
                .enter()
                .append('foreignObject')

                .attr('x', 0)
                .attr('y', 0)
                .attr('width', d => fvScale(d.count))
                .attr('height', d => fvScale(d.count))
                .attr('fill', 'red')
                /*
                .attr('xlink:href', d => {

                    //let filename = dataURL + 'data/feature-vis/channel/' + layer + '-' + d.channel + '-channel' + fv_type
                    //return filename
                })
                */
 
                .attr('clip-path', d => 'url(#fv-clip-path-' + layer + '-' + d.channel + ')')
               
                .attr("transform", (d, i) => "translate(" +
                    d.x + ',' +
                    d.y + " )"
                )
                .attr('id', d => layer + '-' + d.channel + '-channel')
                .classed('fv-ch', true)
                .classed('fv-ch-' + layer, true)
                
                .append('xhtml:canvas')
                .attr('width', d => fvScale(d.count))
                .attr('height', d => fvScale(d.count))

                .on('mouseover', function (curr_channel) {
                    d3.selectAll('.fv-ch').attr('filter', 'url(#grayscale)')
                    d3.select(this).attr('filter', null)

                    // let curr_channel = d3.select(this).data()[0]
                    let hoveredChannel = layer + '-' + curr_channel.channel

                    d3.selectAll('.dag-edge-' + hoveredChannel + '-in')
                        .classed('dag-edge-animate-in', true)

                    d3.selectAll('.dag-edge-' + hoveredChannel + '-out')
                        .classed('dag-edge-animate-out', true)

                    d3.selectAll('.fv-ch-' + indexLayer[layerIndex[layer] - 1])
                        .filter(d => {
                            let tempPrevChannels = d['prev_channels'].map(pv => pv['prev_channel'])
                            if (tempPrevChannels.includes(curr_channel.channel)) {
                                return d
                            }
                        })
                        .attr('filter', null)

                    curr_channel['prev_channels'].forEach(pc => {
                        d3.selectAll('#' + indexLayer[layerIndex[layer] + 1] + '-' + pc['prev_channel'] + '-channel')
                            .attr('filter', null)
                    });

                    d3.selectAll('#' + hoveredChannel + '-ex-rect')
                        .style('visibility', 'visible')
                    
                        d3.selectAll('#' + hoveredChannel + '-ex-text')
                        .style('visibility', 'visible')

                    d3.selectAll('#' + hoveredChannel + '-attr-rect')
                        .style('visibility', 'visible')

                    d3.selectAll('.' + hoveredChannel + '-attr')
                        .style('visibility', 'visible')

                    d3.selectAll('.' + 'dag-edge-' + hoveredChannel)
                        .style('visibility', 'visible')

                    d3.selectAll('.' + 'attr-ch-label-' + hoveredChannel)
                        .style('visibility', 'visible')

                })
                .on('mousemove', function (d) {
                    // diversity hovering
                    let [mouseX, mouseY] = d3.mouse(this)
                    let channelSelection = d3.select(this)
                    let diversity = d3.min([d3.max([parseInt(4 * mouseX / d.width),0]),3])


                })
                .on('mouseout', function (d) {

                    let channelSelection = d3.select(this)
                    let hoveredChannel = layer + '-' + d.channel

                    d3.selectAll('.fv-ch').attr('filter', null)

                    d3.selectAll('.' + layer + '-' + d.channel + '-dataset-p')
                        .style('visibility', 'hidden')


                    d3.selectAll('.dag-edge-' + layer + '-' + d.channel + '-in')
                        .classed('dag-edge-animate-in', false)

                    d3.selectAll('.dag-edge-' + layer + '-' + d.channel + '-out')
                        .classed('dag-edge-animate-out', false)

                    /*
                    channelSelection.attr('xlink:href', d => dataURL + 'data/feature-vis/channel/' + layer + '-' + d.channel + '-channel' + fv_type)
                    */

                    d3.selectAll('#' + hoveredChannel + '-ex-rect')
                        .style('visibility', 'hidden')
                    
                    d3.selectAll('#' + hoveredChannel + '-ex-text')
                        .style('visibility', 'hidden')

                    d3.selectAll('#' + hoveredChannel + '-attr-rect')
                        .style('visibility', isAlreadyClicked[hoveredChannel] ? 'visible' : 'hidden')

                    d3.selectAll('.' + hoveredChannel + '-attr')
                        .style('visibility', isAlreadyClicked[hoveredChannel] ? 'visible' : 'hidden')

                    d3.selectAll('.' + 'dag-edge-attr-' + hoveredChannel)
                        .style('visibility', isAlreadyClicked[hoveredChannel] ? 'visible' : 'hidden')

                    d3.selectAll('.' + 'attr-ch-label-' + hoveredChannel)
                        .style('visibility', isAlreadyClicked[hoveredChannel] ? 'visible' : 'hidden')

                })
        

            // Write channel label
            dagG.selectAll('.fv-ch-label-' + layer)
                .data(dag[layer])
                .enter()
                .append('text')
                .attr('x', d => d.x)
                .attr('y', d => d.y - 3)
                .text(d => d.channel)
                .classed('fv-ch-label', true)
                .classed('fv-ch-label-' + layer, true)
                .attr('id', d => 'fv-ch-label-' + layer + '-' + d.channel)

        }

        function drawLayerLabels() {
            dagG.selectAll('.dag-layer-label')
                .data(layers)
                .enter()
                .append('text')
                // .attr('x', d => 0 - ((dag[d].length * fvWidth + (dag[d].length - 1) * fvHorizontalSpace) / 2))
                // .attr('y', (d, i) => layerIndex[d] * layerVerticalSpace)
                .text(d => d)
                .attr('transform', d => 'translate(' + (0 - (fvWidth / 4 + ((dag[d].length * fvWidth + (dag[d].length - 1) * fvHorizontalSpace) / 2))) + ',' + (layerIndex[d] * layerVerticalSpace + fvHeight / 2) + ')')
                .attr('text-anchor', 'end')
                .classed('dag-layer-label', true)
                .attr('id', d => 'dag-layer-label-' + d)
        }
        let edgeScale = d3.scaleLinear()
            .domain([0, 1300]) // check this, do d3.max instead? OR 1300
            .range([0, 6])

        function drawEdgesPerLayer(layer, channel) {
            // update dag data with edge count
            let layerToUpdate = indexLayer[layerIndex[layer] + 1]
            channel['prev_channels'].forEach(prevChannel => {
                let channelToUpdate = dag[layerToUpdate].find(function (element) {
                    return element.channel === prevChannel['prev_channel'];
                });

                channelToUpdate.numOfEdgesIn += 1
            })

            dagG.selectAll('.dag-edge-temp-' + layer) // need the throwaway class since we do this for every channel and use multiple classes
                .data(channel['prev_channels'])
                .enter()
                .append('path')
                .attr('d', d => {
                    let layerToConnectTo = indexLayer[layerIndex[layer] + 1]
                    let channelToConnectTo = dag[layerToConnectTo].find(function (element) {
                        return element.channel === d['prev_channel'];
                    });

                    return "M" + (channel.x + channel.width / 2) + "," + (channel.y + fvHeight - (fvHeight - channel.width))
                        + "C" + (channel.x + channel.width / 2) + " " + (channel.y + fvHeight - (fvHeight - channel.width)
                            + layerVerticalSpace / 2) + "," + (channelToConnectTo.x + channelToConnectTo.width / 2) + " "
                        + (channelToConnectTo.y - layerVerticalSpace / 2 - (fvHeight - channelToConnectTo.width)) + ","
                        + (channelToConnectTo.x + channelToConnectTo.width / 2) + " " + channelToConnectTo.y
                })
                .style('stroke-width', d => edgeScale(d.inf))

                .attr('class', d => {

                    let classString = 'dag-edge' +
                        ' ' + 'dag-edge-' + layer +
                        ' ' + 'dag-edge-' + layer + '-' + channel.channel +
                        ' ' + 'dag-edge-' + indexLayer[layerIndex[layer] + 1] + '-' + d['prev_channel'] +
                        ' ' + 'dag-edge-' + layer + '-' + channel.channel + '-out'

                    if (d.layer != 'mixed5b') {
                        classString += ' ' + 'dag-edge-' + indexLayer[layerIndex[layer] + 1] + '-' + d['prev_channel'] + '-in'

                    }

                    return classString
                })
                .attr('id', d => {
                    let layerToConnectTo = indexLayer[layerIndex[layer] + 1]
                    let channelToConnectTo = dag[layerToConnectTo].find(function (element) {
                        return element.channel === d['prev_channel'];
                    });
                    return 'dag-edge-' + layer + '-' + channel.channel + '-' + layerToConnectTo + '-' + channelToConnectTo.channel
                })
                .on('mouseover', function () {
                    d3.selectAll('.fv-ch').attr('filter', 'url(#grayscale)')
                })
                .on('mouseout', function () {
                    d3.selectAll('.fv-ch').attr('filter', null)
                    d3.selectAll('.fv-de')
                        .style('visibility', 'hidden')
                })
        }

        function drawEdges() {
            layers.forEach(l => {
                if (l !== layers[layers.length - 1]) { // don't draw edges from the last layer downward
                    // console.log('draw edges for ', l)
                    dag[l].forEach(ch => {
                        drawEdgesPerLayer(l, ch)
                    });
                }
            });
        }


        function drawDAG() {

            let maxNumEdgesIn = []
            layers.forEach(l => {
                computeChannelCoordinates(l)
                initializeChannelEdgeCount(l)
            });

            drawEdges()

            layers.forEach(l => {

                let temp = d3.max(dag[l], d => {
                    return d.numOfEdgesIn
                })
                maxNumEdgesIn.push(temp)

                drawChannels(l)
            });

            drawLayerLabels()
        }

        drawDAG()

    })

}
}



