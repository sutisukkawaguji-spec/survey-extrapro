// ============================================================
// map-state.js — Global state shared by all map modules
// ============================================================
'use strict';

var map, infoWindow, drawingManager;
var autocompleteService, placesService, directionsService, directionsRenderer;

var user = null, currentProject = null, mapLibrary = [];
var surveyRecords = new Map();
var mapLayers = {};          // { layerId: { layer, name, color, url } }
var overviewMarkers = [];   // { marker, featureId, layerId }
var labelMarkers = [];      // { marker, featureId, layerId }
var recordMarkers = [];     // saved survey pin markers
var drawnItems = [];        // general drawings (non-survey)
var activeSurveyDrawings = []; // drawings made during survey mode
var savedShapesOnMap = [];  // shapes loaded from a saved record

var userMarker = null;
var isFollowing = false;
var isNavigating = false;
var isSurveyMode = false;
var targetFeature = null;
var distanceToTarget = Infinity;
var surveyPromptShown = false;

var selectedFeatureId = null;
var selectedLocation = null;       // LatLng of selected parcel centre
var currentFeatureForSheet = null; // feature object for open sheet
var currentLayerNameForSheet = '';
var currentDrawingMode = null;
