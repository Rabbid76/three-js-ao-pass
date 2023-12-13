import * as THREE from 'three';
import Stats from 'three/examples/jsm/libs/stats.module.js';
import { GUI } from 'three/examples/jsm/libs/lil-gui.module.min.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { AOShader } from './AOShader.js';
import { AOPass } from './AOPass.js';

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath( './draco/' );
dracoLoader.setDecoderConfig( { type: 'js' } );
const gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader( dracoLoader );

let mixer;

const generateSponzaScene = (group) => {

    gltfLoader.load( 'glb/sponza_cd.glb', ( gltf ) => {
        const model = gltf.scene;
        const box = new THREE.Box3().setFromObject(model);
        console.log(box);
        group.add( model );
        updateClipBox();
    }, undefined, ( e ) => console.error( e ) );

};

const updateClipBox = () => {

    const box = new THREE.Box3().setFromObject( scene );
    aoPass.setSceneClipBox( box );

};

const clock = new THREE.Clock();
const container = document.createElement( 'div' );
document.body.appendChild( container );

const stats = new Stats();
container.appendChild( stats.dom );

const renderer = new THREE.WebGLRenderer( { canvas: three_canvas, antialias: true } );
renderer.setSize( window.innerWidth, window.innerHeight );
document.body.appendChild( renderer.domElement );

const pmremGenerator = new THREE.PMREMGenerator( renderer );

const scene = new THREE.Scene();
scene.background = new THREE.Color( 0xbfe3dd );
scene.environment = pmremGenerator.fromScene( new RoomEnvironment( renderer ), 0.04 ).texture;

const camera = new THREE.PerspectiveCamera( 40, window.innerWidth / window.innerHeight, 1, 100 );
camera.position.set( -8, 1.5, 0 );

const controls = new OrbitControls( camera, renderer.domElement );
controls.target.set( 0, 1.5, 0 );
controls.update();
controls.enablePan = false;
controls.enableDamping = true;

generateSponzaScene( scene );

const width = window.innerWidth;
const height = window.innerHeight;
const pixelRatio = renderer.getPixelRatio();
const maxSamples = renderer.capabilities.maxSamples;

const depthTexture = new THREE.DepthTexture();
const renderTarget = new THREE.WebGLRenderTarget( width * pixelRatio, height * pixelRatio, {
    type: THREE.HalfFloatType,
    samples: maxSamples,
    depthTexture: depthTexture
} );
renderTarget.texture.name = 'EffectComposer.rt1';
const composer = new EffectComposer( renderer, renderTarget );

const renderPass = new RenderPass( scene, camera );
composer.addPass( renderPass );

const aoPass = new AOPass( scene, camera, width, height );
aoPass.output = AOPass.OUTPUT.Denoise;
aoPass.setGBuffer( depthTexture, undefined );
composer.addPass( aoPass );

const outputPass = new OutputPass();
composer.addPass( outputPass );

// Init gui
const gui = new GUI();

gui.add( aoPass, 'output', {
    'Default': AOPass.OUTPUT.Default,
    'Diffuse': AOPass.OUTPUT.Diffuse,
    'AO Only': AOPass.OUTPUT.AO,
    'AO Only + Denoise': AOPass.OUTPUT.Denoise,
    //'Depth': AOPass.OUTPUT.Depth,
    //'Normal': AOPass.OUTPUT.Normal
} ).onChange( function ( value ) {

    aoPass.output = value;

} );

const aoParameters = {
    algorithm: AOShader.ALGORITHM.GTAO,
    radius: 4.,
    distanceExponent: 2.,
    thickness: 10.,
    distanceFallOff: 1.,
    bias: 0.001,
    scale: 1.,
    samples: 24,
    clipRangeCheck: true,
    depthRelativeBias: false,
    nvAlignedSamples: false,
    screenSpaceRadius: false,
    aoNoiseType: 'magic-square',
};
const pdParameters = {
    lumaPhi: 10.,
    depthPhi: 2.,
    normalPhi: 3.,
    radius: 4.,
    radiusExponent: 1.,
    rings: 2.,
    samples: 16,
};
aoPass.updateAoMaterial( aoParameters );
aoPass.updatePdMaterial( pdParameters );
gui.add( aoPass, 'intensity' ).min( 0 ).max( 1 ).step( 0.01 );
gui.add( aoParameters, 'algorithm', {
    'SSAO': AOShader.ALGORITHM.SSAO,
    'SAO': AOShader.ALGORITHM.SAO,
    'N8AO': AOShader.ALGORITHM.N8AO,
    'HBAO': AOShader.ALGORITHM.HBAO,
    'GTAO': AOShader.ALGORITHM.GTAO,
} ).onChange( () => {

    aoParameters.nvAlignedSamples = aoParameters.algorithm === AOShader.ALGORITHM.GTAO || aoParameters.algorithm === AOShader.ALGORITHM.HBAO ? 0 : 1;
    nvAlignedSamplesController.updateDisplay();
    aoPass.updateAoMaterial( aoParameters );

} );
gui.add( aoParameters, 'radius' ).min( 0.01 ).max( 10 ).step( 0.01 ).onChange( () => aoPass.updateAoMaterial( aoParameters ) );
gui.add( aoParameters, 'distanceExponent' ).min( 1 ).max( 4 ).step( 0.01 ).onChange( () => aoPass.updateAoMaterial( aoParameters ) );
gui.add( aoParameters, 'thickness' ).min( 0.01 ).max( 10 ).step( 0.01 ).onChange( () => aoPass.updateAoMaterial( aoParameters ) );
gui.add( aoParameters, 'distanceFallOff' ).min( 0 ).max( 1 ).step( 0.01 ).onChange( () => aoPass.updateAoMaterial( aoParameters ) );
gui.add( aoParameters, 'bias' ).min( 0 ).max( 0.1 ).step( 0.0001 ).onChange( () => aoPass.updateAoMaterial( aoParameters ) );
gui.add( aoParameters, 'scale' ).min( 0.01 ).max( 2.0 ).step( 0.01 ).onChange( () => aoPass.updateAoMaterial( aoParameters ) );
gui.add( aoParameters, 'samples' ).min( 2 ).max( 64 ).step( 1 ).onChange( () => aoPass.updateAoMaterial( aoParameters ) );
const nvAlignedSamplesController = gui.add( aoParameters, 'nvAlignedSamples' ).onChange( () => aoPass.updateAoMaterial( aoParameters ) );
gui.add( aoParameters, 'screenSpaceRadius' ).onChange( () => aoPass.updateAoMaterial( aoParameters ) );
const poissonDenoiseFolder = gui.addFolder('Poisson denoise');
poissonDenoiseFolder.close();
poissonDenoiseFolder.add( aoParameters, 'aoNoiseType', [ 'magic-square', 'random' ] ).onChange( () => aoPass.updateAoMaterial( aoParameters ) );
poissonDenoiseFolder.add( pdParameters, 'lumaPhi' ).min( 0 ).max( 20 ).step( 0.01 ).onChange( () => aoPass.updatePdMaterial( pdParameters ) );
poissonDenoiseFolder.add( pdParameters, 'depthPhi' ).min( 0.01 ).max( 20 ).step( 0.01 ).onChange( () => aoPass.updatePdMaterial( pdParameters ) );
poissonDenoiseFolder.add( pdParameters, 'normalPhi' ).min( 0.01 ).max( 20 ).step( 0.01 ).onChange( () => aoPass.updatePdMaterial( pdParameters ) );
poissonDenoiseFolder.add( pdParameters, 'radius' ).min( 0 ).max( 32 ).step( 1 ).onChange( () => aoPass.updatePdMaterial( pdParameters ) );
poissonDenoiseFolder.add( pdParameters, 'radiusExponent' ).min( 0.1 ).max( 4. ).step( 0.1 ).onChange( () => aoPass.updatePdMaterial( pdParameters ) );
poissonDenoiseFolder.add( pdParameters, 'rings' ).min( 1 ).max( 16 ).step( 0.125 ).onChange( () => aoPass.updatePdMaterial( pdParameters ) );
poissonDenoiseFolder.add( pdParameters, 'samples' ).min( 2 ).max( 32 ).step( 1 ).onChange( () => aoPass.updatePdMaterial( pdParameters ) );

window.addEventListener( 'resize', onWindowResize );

function onWindowResize() {

    const width = window.innerWidth;
    const height = window.innerHeight;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    renderer.setSize( width, height );
    composer.setSize( width, height );

}

function animate() {

    requestAnimationFrame( animate );

    const delta = clock.getDelta();

    if ( mixer ) {

        mixer.update( delta );

    }

    controls.update();

    stats.begin();
    composer.render();
    stats.end();

}

animate();