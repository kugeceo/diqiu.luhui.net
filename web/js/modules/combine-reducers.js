import { combineReducers } from 'redux';
import { createResponsiveStateReducer } from 'redux-responsive';
import { modalReducer, modalAboutPage } from './modal/reducers';
import feedbackReducer from './feedback/reducers';
import projectionReducer from './projection/reducer';
import { shortLink } from './link/reducers';
import {
  requestedEvents,
  requestedEventSources,
  requestedEventCategories,
  eventsReducer,
  eventRequestResponse
} from './natural-events/reducers';
import tourReducer from './tour/reducers';
import mapReducer from './map/reducers';
import {
  notificationsRequest,
  notificationsReducer
} from './notifications/reducers';
import { getProjInitialState } from './projection/util';
import { compareReducer } from './compare/reducers';
import sidebarReducer from './sidebar/reducers';
import {
  layerReducer,
  getInitialState as getLayersInitialState
} from './layers/reducers';
import {
  dateReducer,
  getInitialState as getDateInitialState
} from './date/reducers';
import { animationReducer } from './animation/reducers';
import { paletteReducer, getInitialPaletteState } from './palettes/reducers';
import {
  vectorStyleReducer,
  getInitialVectorStyleState
} from './vector-styles/reducers';
import dataDownloadReducer from './data/reducers';
import { get as lodashGet } from 'lodash';
import { imageDownloadReducer } from './image-download/reducers';

function lastAction(state = null, action) {
  return action;
}

/**
 * Access to page size so various resize listeners are
 * no longer necessary
 */
const responsiveStateReducer = createResponsiveStateReducer(
  {
    extraSmall: 500,
    small: 740,
    medium: 1000,
    large: 1280,
    extraLarge: 1400
  },
  {
    extraFields: () => ({
      screenWidth: window.innerWidth,
      screenHeight: window.innerHeight
    })
  }
);
/**
 * Get initial module states based on config
 * and parameters
 *
 * @param {Object} models | Legacy models
 * @param {Object} config
 * @param {Object} parameters | parameters parsed from permalink
 */
export function getInitialState(models, config, parameters) {
  const eventsIgnoreArray = {
    ignore: lodashGet(config, 'naturalEvents.skip') || []
  };

  return {
    parameters,
    config,
    models,
    date: getDateInitialState(config),
    proj: getProjInitialState(config),
    layers: getLayersInitialState(config),
    requestedEvents: eventRequestResponse(eventsIgnoreArray),
    requestedEventSources: eventRequestResponse(eventsIgnoreArray),
    requestedEventCategories: eventRequestResponse(eventsIgnoreArray),
    palettes: getInitialPaletteState(config),
    vectorStyles: getInitialVectorStyleState(config)
  };
}
const defaultReducer = (state = {}) => state;
const reducers = {
  proj: projectionReducer,
  modal: modalReducer,
  date: dateReducer,
  feedback: feedbackReducer,
  notifications: notificationsReducer,
  config: defaultReducer,
  models: defaultReducer,
  parameters: defaultReducer,
  browser: responsiveStateReducer,
  sidebar: sidebarReducer,
  compare: compareReducer,
  layers: layerReducer,
  events: eventsReducer,
  data: dataDownloadReducer,
  palettes: paletteReducer,
  vectorStyles: vectorStyleReducer,
  tour: tourReducer,
  map: mapReducer,
  animation: animationReducer,
  imageDownload: imageDownloadReducer,
  requestedEvents,
  requestedEventSources,
  requestedEventCategories,
  modalAboutPage,
  shortLink,
  notificationsRequest,
  lastAction: lastAction
};
const appReducer = combineReducers(reducers);
/**
 * Top level reducer function w/ option to reset state
 */
export default (state, action) => {
  if (action.type === 'APP_RESET') {
    state = undefined;
  }

  return appReducer(state, action);
};