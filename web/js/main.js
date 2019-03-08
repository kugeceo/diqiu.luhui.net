import 'babel-polyfill'; // Needed for worldview-components in IE and older browsers
import 'whatwg-fetch';
import React from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux';
import { createStore, applyMiddleware } from 'redux';
import { each as lodashEach, debounce as lodashDebounce } from 'lodash';
import { getMiddleware } from './redux-config-helpers';
import {
  createReduxLocationActions,
  listenForHistoryChange
} from 'redux-location-state';
import { mapLocationToState, getParamObject } from './location';
import { stateToParams } from './redux-location-state-customs';
import createBrowserHistory from 'history/createBrowserHistory';
import reducers, { getInitialState } from './modules/combine-reducers';
import App from './app';
import util from './util/util';
import loadingIndicator from './ui/indicator';
import Brand from './brand';
import { combineModels } from './combine-models';
import { parse } from './parse';
import { updatePermalink } from './modules/link/actions';
import { combineUi } from './combine-ui';
import palettes from './palettes/palettes';
import { updateLegacyModule } from './modules/migration/actions';
import { validate as layerValidate } from './layers/layers';

const history = createBrowserHistory();
const isDevelop = !!(
  process &&
  process.env &&
  process.env.NODE_ENV === 'development'
);
let parameters = util.fromQueryString(location.search);
const configURI = Brand.url('config/wv.json');
const startTime = new Date().getTime();

let elapsed = util.elapsed;
let errors = [];

// Document ready function
window.onload = () => {
  if (!parameters.elapsed) {
    elapsed = function() {};
  }
  elapsed('loading config', startTime, parameters);
  var promise = $.getJSON(configURI);

  loadingIndicator.delayed(promise, 1000);
  promise
    .done(config => {
      elapsed('Config loaded', startTime, parameters);
      let legacyState = parse(parameters, config, errors);
      layerValidate(errors, config);
      let requirements = [palettes.requirements(legacyState, config, true)];
      $.when
        .apply(null, requirements)
        .then(() => util.wrap(render(config, parameters, legacyState))); // Wrap render up
    })
    .fail(util.error);
};

const render = (config, parameters, legacyState) => {
  config.parameters = parameters;
  let models = combineModels(config, legacyState); // Get legacy models

  // Get Permalink parse/serializers
  const paramSetup = getParamObject(
    parameters,
    config,
    models,
    legacyState,
    errors
  );

  const {
    locationMiddleware,
    reducersWithLocation
  } = createReduxLocationActions(
    paramSetup,
    mapLocationToState,
    history,
    reducers,
    stateToParams
  );
  const middleware = getMiddleware(isDevelop, locationMiddleware); // Get Various Middlewares
  const store = createStore(
    reducersWithLocation,
    getInitialState(models, config, parameters),
    applyMiddleware(...middleware)
  );
  lodashEach(models, function(component, i) {
    if (component.load && !component.loaded) {
      component.load(legacyState, errors);
    }
    const dispatchUpdate = lodashDebounce(() => {
      store.dispatch(updateLegacyModule(i, component));
    }, 100);
    // sync old and new state
    component.events.any(dispatchUpdate);
  });

  let queryString = '';
  history.listen((location, action) => {
    const newString = location.search;
    if (queryString !== newString) {
      queryString = newString;
      store.dispatch(updatePermalink(queryString)); // Keep permalink in redux-store
    }
  });
  listenForHistoryChange(store, history);
  elapsed('Render', startTime, parameters);

  let mouseMoveEvents = util.events();

  ReactDOM.render(
    <Provider store={store}>
      <App models={models} mapMouseEvents={mouseMoveEvents} />
    </Provider>,
    document.getElementById('app')
  );

  combineUi(models, config, mouseMoveEvents); // Legacy UI
  util.errorReport(errors);
};
