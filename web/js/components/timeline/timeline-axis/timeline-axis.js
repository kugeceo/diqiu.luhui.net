import React, { Component } from 'react';
import PropTypes from 'prop-types';
import Draggable from 'react-draggable';
import moment from 'moment';
import lodashDebounce from 'lodash/debounce';

import GridRange from './grid-range/grid-range';
import DateToolTip from './date-tooltips';
import DraggerContainer from './dragger-container';

import { getTimeRange } from './date-calc';
import TimelineRangeSelector from '../../range-selection/range-selection';
import { timeScaleOptions, timeScaleToNumberKey } from '../../../modules/date/constants';
import HoverLine from './hover-line';

import { getIsBetween, getISODateFormatted } from '../date-util';

class TimelineAxis extends Component {
  constructor(props) {
    super(props);
    this.state = {
      draggerWidth: 49,
      hoverLinePosition: 0,
      isDraggerDragging: false,
      isTimelineDragging: false,
      showDraggerTime: false,
      dragSentinelCount: 0,
      draggerPosition: 0,
      draggerVisible: true,
      draggerPositionB: 0,
      draggerVisibleB: true,
      moved: false,
      hoverTime: null,
      showHoverLine: false,
      draggerTimeState: null,
      draggerTimeStateB: null,
      leftOffset: 0,
      position: 0,
      currentTimeRange: null,
      transformX: 0,
      gridWidth: 12,
      animationStartLocation: 0,
      animationEndLocation: 0,
      isAnimationDraggerDragging: false,
      wheelZoom: false
    };
    // axis
    this.handleDrag = this.handleDrag.bind(this);
    this.handleStartDrag = this.handleStartDrag.bind(this);
    this.handleStopDrag = this.handleStopDrag.bind(this);
    this.wheelZoom = this.wheelZoom.bind(this);

    // animation draggers/range
    // this.animationDraggerPositionUpdate = lodashDebounce(this.animationDraggerPositionUpdate.bind(this), 50, { leading: true, trailing: true });
    this.animationDraggerPositionUpdate = this.animationDraggerPositionUpdate.bind(this);

    // hover and times
    this.toggleShowDraggerTime = this.toggleShowDraggerTime.bind(this);
    this.displayDate = this.displayDate.bind(this);
    this.showHoverOn = this.showHoverOn.bind(this);
    this.showHoverOff = this.showHoverOff.bind(this);
    this.setLineTime = this.setLineTime.bind(this);
  }
  // ? how do position and transforms change between scale changes? lock into one line would be ideal
  updateScale = (inputDate, timeScale, axisWidthInput, leftOffsetFixedCoeff, hoverChange) => {
    let maxDateTimelineEndDateLimit = this.props.timelineEndDateLimit;
    let options = timeScaleOptions[timeScale].timeAxis;
    let gridWidth = options.gridWidth;
    let axisWidth = axisWidthInput || this.props.axisWidth;
    let leftOffset = leftOffsetFixedCoeff ? axisWidth * leftOffsetFixedCoeff : this.state.leftOffset;

    if (leftOffset === 0) {
      leftOffset = axisWidth / 2;
    }

    let numberOfVisibleTiles = Number((axisWidth / gridWidth).toFixed(8));
    let gridNumber = Math.floor(numberOfVisibleTiles * 1.5); // should get from state?
    let dragSentinelChangeNumber = gridWidth * (Math.floor(numberOfVisibleTiles * 0.25) + 1);
    if (timeScale === 'year') {
      let endLimitYear = moment.utc(this.props.timelineEndDateLimit).year() + 1;
      let startLimitYear = moment.utc(this.props.timelineStartDateLimit).year();
      gridNumber = endLimitYear - startLimitYear;
      numberOfVisibleTiles = gridNumber;
    }

    // Floating point issues need to be handled more cleanly
    let midPoint = -((gridWidth * gridNumber) / 2) + ((numberOfVisibleTiles / 2) * gridWidth);
    let hoverTime = moment.utc(this.state.hoverTime);

    if (hoverTime.isAfter(maxDateTimelineEndDateLimit)) {
      hoverTime = maxDateTimelineEndDateLimit;
    }

    hoverTime = inputDate ? moment.utc(inputDate) : hoverTime;
    let hoverTimeZero = hoverTime.clone().startOf(timeScale);
    if (timeScale === 'year') {
      hoverTimeZero = moment.utc(this.props.timelineStartDateLimit);
    }
    let hoverTimeNextZero = hoverTimeZero.clone().add(1, timeScale);

    let draggerDateActual;
    let draggerDateActualB;
    if (this.props.draggerSelected === 'selected') {
      draggerDateActual = hoverChange ? this.state.draggerTimeState : inputDate || this.state.draggerTimeState;
      draggerDateActualB = this.state.draggerTimeStateB;
    } else {
      draggerDateActual = this.state.draggerTimeState;
      draggerDateActualB = hoverChange ? this.state.draggerTimeStateB : inputDate || this.state.draggerTimeStateB;
    }

    // value of hover time, hover time timeunit zeroed, hover time next unit timeunit zeroed
    let hoverTimeValue = hoverTime.valueOf();
    let hoverTimeZeroValue = hoverTimeZero.valueOf();
    let hoverTimeNextZeroValue = hoverTimeNextZero.valueOf();

    let diffZeroValues = hoverTimeNextZeroValue - hoverTimeZeroValue;
    let diffFactor = diffZeroValues / gridWidth;
    let diffStartAndZeroed = hoverTimeValue - hoverTimeZeroValue;

    let pixelsToAdd = diffStartAndZeroed / diffFactor;

    // offset grids needed since each zoom in won't be centered
    let offSetGrids = Math.floor(leftOffset / gridWidth);
    let offSetGridsDiff = offSetGrids - Math.floor(numberOfVisibleTiles / 2);

    let gridsToSubtract = Math.floor(gridNumber / 2) + offSetGridsDiff;
    let gridsToAdd = Math.floor(gridNumber / 2) - offSetGridsDiff;

    let timeRange = this.getTimeRangeArray(gridsToSubtract, gridsToAdd, hoverTime);

    // get front and back dates
    let frontDate = moment.utc(timeRange[0].rawDate);
    let backDate = timeRange[timeRange.length - 1].rawDate;
    // check if dragger date is between front/back dates, null set to ignore granularity (go to ms), [] for inclusive of front/back dates

    let draggerPosition = 0;
    let draggerVisible = false;
    if (this.props.compareModeActive || this.props.draggerSelected === 'selected') {
      let isBetween = getIsBetween(draggerDateActual, frontDate, backDate);
      if (isBetween) {
        draggerPosition = Math.abs(frontDate.diff(draggerDateActual, timeScale, true) * gridWidth);
        draggerVisible = true;
      }
    }

    let draggerPositionB = 0;
    let draggerVisibleB = false;
    if (this.props.compareModeActive || this.props.draggerSelected === 'selectedB') {
      let isBetweenB = getIsBetween(draggerDateActualB, frontDate, backDate);
      if (isBetweenB) {
        draggerPositionB = Math.abs(frontDate.diff(draggerDateActualB, timeScale, true) * gridWidth);
        draggerVisibleB = true;
      }
    }

    let position;
    // axisWidthInput conditional in place to handle resize centering of position
    if (axisWidthInput) {
      position = midPoint;
    } else {
      //  - (offSetGridsDiff * gridWidth) to compensate off center zooming repositioning
      position = +(midPoint - (axisWidth / 2 - leftOffset)).toFixed(10) - (offSetGridsDiff * gridWidth);
      if (gridNumber % 2 !== 0) { // handle odd number gridNumber grid offset
        position += gridWidth / 2;
      }
    }

    if (timeScale === 'year') {
      position = 0 + axisWidth / 2 + (leftOffset - axisWidth / 2);
    }

    // update animation draggers
    let animationStartDraggerLocation;
    let animationEndDraggerLocation;

    if (this.props.animStartLocationDate) {
      animationStartDraggerLocation = moment.utc(this.props.animStartLocationDate).diff(frontDate, timeScale, true) * gridWidth;
      animationEndDraggerLocation = moment.utc(this.props.animEndLocationDate).diff(frontDate, timeScale, true) * gridWidth;
    }

    // get axis bounds
    let timelineStartDateLimit = this.props.timelineStartDateLimit;
    let timelineEndDateLimit = this.props.timelineEndDateLimit;
    let diffFromStartDateLimit = hoverTime.diff(timelineStartDateLimit, timeScale);
    let leftBound = frontDate.diff(timelineEndDateLimit, timeScale) * gridWidth + (midPoint * 1.5) + axisWidth;
    let rightBound = (diffFromStartDateLimit * gridWidth) + (midPoint * 1.5);
    rightBound = rightBound < position ? position : rightBound;
    // leftBound = leftBound < position ? position : leftBound;

    this.setState({
      draggerTimeState: draggerDateActual,
      draggerTimeStateB: draggerDateActualB,
      draggerPosition: draggerPosition - pixelsToAdd + position - this.state.draggerWidth,
      draggerVisible,
      draggerPositionB: draggerPositionB - pixelsToAdd + position - this.state.draggerWidth,
      draggerVisibleB,
      currentTimeRange: timeRange,
      transformX: -pixelsToAdd - 2,
      gridNumber,
      gridWidth,
      numberOfVisibleTiles,
      moved: false,
      dragSentinelChangeNumber,
      position,
      midPoint: position,
      dragSentinelCount: 0,
      showHoverLine: false,
      animationStartLocation: animationStartDraggerLocation + position - pixelsToAdd - 2,
      animationEndLocation: animationEndDraggerLocation + position - pixelsToAdd - 2,
      leftBound,
      rightBound,
      wheelZoom: false
    });
  }

  // changes timeScale state
  wheelZoom = (e) => {
    let { timeScale, hasSubdailyLayers, changeTimeScale } = this.props;
    let timeScaleNumber = Number(timeScaleToNumberKey[timeScale]);
    let maxTimeScaleNumber = hasSubdailyLayers ? 5 : 3;
    if (e.deltaY > 0) { // wheel zoom out
      if (timeScaleNumber > 1) {
        this.setState({
          wheelZoom: true
        }, changeTimeScale(timeScaleNumber - 1));
      }
    } else {
      if (timeScaleNumber < maxTimeScaleNumber) { // wheel zoom in
        this.setState({
          wheelZoom: true
        }, changeTimeScale(timeScaleNumber + 1));
      }
    }
  }

  // drag axis - will update date range if dragged into past/future past dragSentinelChangeNumber
  handleDrag = (e, d) => {
    e.stopPropagation();
    e.preventDefault();
    let {
      animationStartLocation,
      animationEndLocation,
      gridWidth,
      dragSentinelChangeNumber,
      dragSentinelCount,
      draggerPosition,
      draggerPositionB,
      position
    } = this.state;
    let { timeScale } = this.props;

    let deltaX = d.deltaX;
    position = position + deltaX;
    draggerPosition = draggerPosition + deltaX;
    draggerPositionB = draggerPositionB + deltaX;
    animationStartLocation = animationStartLocation + deltaX;
    animationEndLocation = animationEndLocation + deltaX;
    // PRE/POST GRIDARRAY UPDATE NOT NECESSARY FOR YEAR SINCE ALL YEARS ARE DISPLAYED
    if (timeScale === 'year') {
      this.setState({
        draggerPosition,
        draggerPositionB,
        position,
        dragSentinelCount: dragSentinelCount + deltaX,
        animationStartLocation,
        animationEndLocation
      });
    } else {
      if (deltaX > 0) { // dragging right - exposing past dates
        if (dragSentinelCount + deltaX > dragSentinelChangeNumber) {
          // handle over drag the necessitates multiple axis updates
          let overDrag = 0;
          if (dragSentinelCount + deltaX > dragSentinelChangeNumber * 2) {
            overDrag = Math.abs(dragSentinelCount + deltaX - dragSentinelChangeNumber * 2);
          }
          let {
            currentTimeRange,
            transformX,
            draggerVisible,
            draggerVisibleB,
            overDragGrids,
            newDraggerPosition,
            newDraggerPositionB
          } = this.updatePanelDateRange(
            position,
            deltaX,
            draggerPosition,
            draggerPositionB,
            overDrag
          );

          let newDragSentinelCount = dragSentinelCount + deltaX - dragSentinelChangeNumber - overDragGrids * gridWidth;
          this.setState({
            currentTimeRange,
            transformX,
            dragSentinelCount: newDragSentinelCount,
            draggerPosition: newDraggerPosition,
            draggerVisible,
            draggerPositionB: newDraggerPositionB,
            draggerVisibleB,
            position,
            showHoverLine: false,
            animationStartLocation,
            animationEndLocation
          });
        } else {
          // reset dragSentinelCount on direction change to remaining distance to dragSentinelChangeNumber
          let newDragSentinelCount = dragSentinelCount < 0
            ? dragSentinelChangeNumber + dragSentinelCount + deltaX
            : dragSentinelCount + deltaX;
          this.setState({
            draggerPosition,
            draggerPositionB,
            position,
            dragSentinelCount: newDragSentinelCount,
            showHoverLine: false,
            animationStartLocation,
            animationEndLocation
          });
        }
      } else if (deltaX < 0) { // dragging left - exposing future dates
        if (dragSentinelCount + deltaX < -dragSentinelChangeNumber) {
          // handle over drag the necessitates multiple axis updates
          let overDrag = 0;
          if (dragSentinelCount + deltaX < -dragSentinelChangeNumber * 2) {
            overDrag = Math.abs(dragSentinelCount + deltaX + dragSentinelChangeNumber * 2);
          }
          let {
            currentTimeRange,
            transformX,
            draggerVisible,
            draggerVisibleB,
            overDragGrids,
            newDraggerPosition,
            newDraggerPositionB
          } = this.updatePanelDateRange(
            position,
            deltaX,
            draggerPosition,
            draggerPositionB,
            overDrag
          );

          let newDragSentinelCount = dragSentinelCount + deltaX + dragSentinelChangeNumber + overDragGrids * gridWidth;
          this.setState({
            currentTimeRange,
            transformX,
            dragSentinelCount: newDragSentinelCount,
            draggerPosition: newDraggerPosition,
            draggerVisible,
            draggerPositionB: newDraggerPositionB,
            draggerVisibleB,
            position,
            showHoverLine: false,
            animationStartLocation,
            animationEndLocation
          });
        } else {
          // reset dragSentinelCount on direction change to remaining distance to dragSentinelChangeNumber
          let newDragSentinelCount = dragSentinelCount > 0
            ? -dragSentinelChangeNumber + dragSentinelCount + deltaX
            : dragSentinelCount + deltaX;
          this.setState({
            draggerPosition,
            draggerPositionB,
            position,
            dragSentinelCount: newDragSentinelCount,
            showHoverLine: false,
            animationStartLocation,
            animationEndLocation
          });
        }
      }
    }
  }

  // update dates in range based on dragging axis
  updatePanelDateRange = (position, deltaX, draggerPosition, draggerPositionB, overDrag) => {
    let {
      transformX,
      gridWidth,
      currentTimeRange,
      numberOfVisibleTiles,
      draggerVisible,
      draggerVisibleB,
      draggerTimeState,
      draggerTimeStateB
    } = this.state;

    let {
      compareModeActive,
      draggerSelected
    } = this.props;

    numberOfVisibleTiles = Math.floor(numberOfVisibleTiles * 0.25);
    let overDragGrids = Math.ceil(overDrag / gridWidth);
    let timeRangeAdd;
    let transform;
    if (deltaX > 0) { // dragging right - exposing past dates
      let firstDateInRange = currentTimeRange[0].rawDate;
      timeRangeAdd = this.getTimeRangeArray(numberOfVisibleTiles + 1 + overDragGrids, -1, firstDateInRange);

      this.removeBackMultipleInPlace(currentTimeRange, numberOfVisibleTiles + 1 + overDragGrids);
      currentTimeRange.unshift(...timeRangeAdd);

      transform = transformX - (numberOfVisibleTiles + 1 + overDragGrids) * gridWidth;
    } else { // dragging left - exposing future dates
      let lastDateInRange = currentTimeRange[currentTimeRange.length - 1].rawDate;
      timeRangeAdd = this.getTimeRangeArray(-1, numberOfVisibleTiles + 1 + overDragGrids, lastDateInRange);

      this.removeFrontMultipleInPlace(currentTimeRange, numberOfVisibleTiles + 1 + overDragGrids);
      currentTimeRange.push(...timeRangeAdd);

      transform = transformX + (numberOfVisibleTiles + 1 + overDragGrids) * gridWidth;
    }

    // check if dragger is in between range and visible
    let frontDate = currentTimeRange[0].rawDate;
    let backDate = currentTimeRange[currentTimeRange.length - 1].rawDate;

    // default to input dragger positions in the event of no updates
    let newDraggerPosition = draggerPosition;
    let newDraggerPositionB = draggerPositionB;

    let sharedDraggerVisibilityParams = {
      frontDate,
      backDate,
      position,
      transform
    };

    if (compareModeActive) {
      // check if both draggers are in between for visibility/position updates
      let draggerACheck = this.checkDraggerVisibility(
        draggerTimeState,
        draggerVisible,
        newDraggerPosition,
        sharedDraggerVisibilityParams
      );
      draggerVisible = draggerACheck.isVisible;
      newDraggerPosition = draggerACheck.newDraggerPosition;

      let draggerBCheck = this.checkDraggerVisibility(
        draggerTimeStateB,
        draggerVisibleB,
        newDraggerPositionB,
        sharedDraggerVisibilityParams
      );
      draggerVisibleB = draggerBCheck.isVisible;
      newDraggerPositionB = draggerBCheck.newDraggerPosition;
    } else {
      // check individual draggers based on which is currently selected
      if (draggerSelected === 'selected') { // dragger A selected
        let draggerACheck = this.checkDraggerVisibility(
          draggerTimeState,
          draggerVisible,
          newDraggerPosition,
          sharedDraggerVisibilityParams
        );
        draggerVisible = draggerACheck.isVisible;
        newDraggerPosition = draggerACheck.newDraggerPosition;
      } else { // dragger B selectedB
        let draggerBCheck = this.checkDraggerVisibility(
          draggerTimeStateB,
          draggerVisibleB,
          newDraggerPositionB,
          sharedDraggerVisibilityParams
        );
        draggerVisibleB = draggerBCheck.isVisible;
        newDraggerPositionB = draggerBCheck.newDraggerPosition;
      }
    }

    return {
      currentTimeRange: currentTimeRange,
      transformX: transform,
      draggerVisible,
      draggerVisibleB,
      overDragGrids,
      newDraggerPosition,
      newDraggerPositionB
    };
  }

  // timeRange extension to pop NUM times
  removeBackMultipleInPlace = (timeRange, num) => {
    for (let i = 0; i < num; i++) {
      timeRange.pop();
    }
  }
  // timeRange extension to shift NUM times
  removeFrontMultipleInPlace = (timeRange, num) => {
    for (let i = 0; i < num; i++) {
      timeRange.shift();
    }
  }

  // check dragger visibility and return newDraggerPosition if dragger initially false and now visible
  checkDraggerVisibility = (draggerTime, draggerVisible, newDraggerPosition, { frontDate, backDate, position, transform }) => {
    let { gridWidth } = this.state;
    let { timeScale } = this.props;
    let isBetween = getIsBetween(draggerTime, frontDate, backDate);
    if (isBetween) { // B dragger
      if (draggerVisible === false) {
        let frontDateObj = moment.utc(frontDate);
        newDraggerPosition = Math.abs(frontDateObj.diff(draggerTime, timeScale, true) * gridWidth) + position + transform - 50;
      }
      return {
        newDraggerPosition: newDraggerPosition,
        isVisible: true
      };
    } else {
      return {
        newDraggerPosition: newDraggerPosition,
        isVisible: false
      };
    }
  }

  // return date array of days based on:
  // subtract - integer (negative numbers selects start date in the future)
  // add - integer (negative numbers selects end date in the past)
  getTimeRangeArray = (subtract, add, inputDate) => {
    let dayZeroed;
    let startDate;
    let endDate;
    let { timelineEndDateLimit, timelineStartDateLimit, timeScale } = this.props;

    if (timeScale === 'year') {
      dayZeroed = moment.utc(inputDate).startOf('year');
      let endLimitYear = moment.utc(timelineEndDateLimit).year() + 1;
      let startLimitYear = moment.utc(timelineStartDateLimit).year();
      startDate = dayZeroed.year(startLimitYear);
      endDate = dayZeroed.clone().year(endLimitYear);
    } else {
      if (timeScale === 'month') {
        dayZeroed = moment.utc(inputDate).startOf('month');
      } else if (timeScale === 'day') {
        dayZeroed = moment.utc(inputDate).startOf('day');
      } else if (timeScale === 'hour') {
        dayZeroed = moment.utc(inputDate).startOf('hour');
      } else if (timeScale === 'minute') {
        dayZeroed = moment.utc(inputDate).startOf('minute');
      }
      startDate = dayZeroed.clone().subtract(subtract, timeScale);
      endDate = dayZeroed.clone().add(add, timeScale);
    }
    let timeRangeArray = getTimeRange(
      startDate,
      endDate,
      timeScale,
      timelineStartDateLimit,
      timelineEndDateLimit);
    return timeRangeArray;
  }

  // move dragger on axis click
  setLineTime = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.target.className.animVal !== 'grid') {
      return;
    }
    if (!this.state.isAnimationDraggerDragging && !this.state.moved) {
      let {
        leftOffset,
        draggerWidth,
        hoverTime
      } = this.state;
      let { draggerSelected } = this.props;

      let draggerPosition = draggerSelected === 'selected' ? leftOffset - draggerWidth : this.state.draggerPosition;
      let draggerPositionB = draggerSelected === 'selectedB' ? leftOffset - draggerWidth : this.state.draggerPositionB;

      // check if the other dragger visible after clicking and moving then new dragger
      let isCompareModeActive = this.props.compareModeActive;
      let draggerB = draggerSelected === 'selectedB';

      // get front and back dates
      let currentTimeRange = this.state.currentTimeRange;
      let frontDate = currentTimeRange[0].rawDate;
      let backDate = currentTimeRange[currentTimeRange.length - 1].rawDate;

      if (draggerB) {
        // check DRAGGER A visibility
        let draggerAVisible = isCompareModeActive && getIsBetween(this.state.draggerTimeState, frontDate, backDate);

        this.setState({
          draggerPositionB,
          draggerVisible: draggerAVisible,
          draggerVisibleB: true,
          draggerTimeStateB: hoverTime,
          moved: false
        }, this.props.changeDate(new Date(hoverTime), 'selectedB'));
      } else {
        // check DRAGGER B visibility
        let draggerBVisible = isCompareModeActive && getIsBetween(this.state.draggerTimeStateB, frontDate, backDate);
        this.setState({
          draggerPosition,
          draggerVisible: true,
          draggerVisibleB: draggerBVisible,
          draggerTimeState: hoverTime,
          moved: false
        }, this.props.changeDate(new Date(hoverTime), 'selected'));
      }
    }
  }

  componentDidMount() {
    let axisWidth = this.props.axisWidth;
    let timeScale = this.props.timeScale;
    let timelineStartDateLimit = this.props.timelineStartDateLimit;
    let timelineEndDateLimit = this.props.timelineEndDateLimit;

    // get dateA time and relative from start/end limits
    let time = moment.utc(this.props.dateA);
    let diffFromEndDateLimit = time.diff(timelineEndDateLimit, timeScale);
    let diffFromStartDateLimit = time.diff(timelineStartDateLimit, timeScale);
    // format to strings
    time = time.format();

    let draggerTimeStateB;
    if (this.props.dateB) {
      draggerTimeStateB = moment.utc(this.props.dateB).format();
    }

    // get timeScale specifics based on props
    let options = timeScaleOptions[timeScale].timeAxis;
    let gridWidth = options.gridWidth;

    // calculate number of grids viewable based on axisWidth and gridWidth of timeScale
    let numberOfVisibleTiles = Number((axisWidth / gridWidth).toFixed(8));
    // let leftOffset = axisWidth * 0.90;
    // let draggerPosition = tilesTillSelectedDAte * gridWidth - draggerWidth; //# CENTER DRAGGER A
    let draggerVisible = true;
    let draggerVisibleB = false;
    if (this.props.compareModeActive) {
      draggerVisibleB = true;
    }

    // times 1.5 is cutting it close (down to 1 grid at leading edge - will continue to test)
    let gridNumber = Math.floor(numberOfVisibleTiles * 1.5);
    let dragSentinelChangeNumber = gridWidth * (Math.floor(numberOfVisibleTiles * 0.25) + 1);

    //! offset grids needed since each zoom in won't be centered
    // let offSetGrids = Math.floor(leftOffset / gridWidth);
    // let offSetGridsDiff = offSetGrids - Math.floor(numberOfVisibleTiles / 2);

    // let gridsToSubtract = Math.floor(gridNumber/2) + offSetGridsDiff;
    // let gridsToAdd = Math.floor(gridNumber/2) - offSetGridsDiff;

    // get midPoint for position based on # of tiles and gridWidth
    let midPoint = -((gridWidth * gridNumber) / 2) + (numberOfVisibleTiles / 2 * gridWidth);

    let draggerTime = moment.utc(time);
    // let draggerTimeZero = moment.utc(time).startOf(timeScale);
    // let draggerTimeNextZero = moment.utc(draggerTime).startOf(timeScale).add(1, timeScale);

    // let draggerTimeValue = moment.utc(draggerTime).valueOf();
    // let draggerTimeZeroValue = moment.utc(draggerTimeZero).valueOf();
    // let draggerTimeNextZeroValue = moment.utc(draggerTimeNextZero).valueOf();

    // let diffZeroValues = draggerTimeNextZeroValue - draggerTimeZeroValue;
    // let diffFactor = diffZeroValues / gridWidth;
    // let diffStartAndZeroed = draggerTimeValue - draggerTimeZeroValue;

    // handle date array creation
    let timeRange = this.getTimeRangeArray(Math.floor(gridNumber / 2), Math.floor(gridNumber / 2), time);

    let frontDate = moment.utc(timeRange[0].rawDate);
    let draggerPosition = Math.abs(frontDate.diff(draggerTime, timeScale, true) * gridWidth);
    let draggerPositionB = Math.abs(frontDate.diff(moment.utc(draggerTimeStateB), timeScale, true) * gridWidth);

    // animation dragger positioning
    let animationStartDraggerLocation;
    let animationEndDraggerLocation;

    if (this.props.animStartLocationDate) {
      animationStartDraggerLocation = Math.abs(frontDate.diff(this.props.animStartLocationDate, timeScale, true) * gridWidth);
      animationEndDraggerLocation = Math.abs(frontDate.diff(this.props.animEndLocationDate, timeScale, true) * gridWidth);
    }

    // get axis bounds
    let leftBound = (diffFromEndDateLimit * gridWidth) + midPoint;
    let rightBound = (diffFromStartDateLimit * gridWidth) + midPoint;

    if (timeScale === 'year') {
      leftBound = -midPoint * 10;
      rightBound = midPoint * 10;
    }

    this.setState({
      draggerPosition: draggerPosition + midPoint - this.state.draggerWidth,
      draggerVisible,
      draggerPositionB: draggerPositionB + midPoint - this.state.draggerWidth,
      draggerVisibleB,
      numberOfVisibleTiles: numberOfVisibleTiles,
      dragSentinelChangeNumber: dragSentinelChangeNumber,
      currentTimeRange: timeRange,
      gridWidth,
      draggerTimeState: time,
      draggerTimeStateB: draggerTimeStateB,
      hoverTime: time,
      transformX: 0,
      midPoint,
      position: midPoint,
      animationStartLocation: animationStartDraggerLocation + midPoint,
      animationEndLocation: animationEndDraggerLocation + midPoint,
      leftBound,
      rightBound

    }, function() {
      this.updateScale(time, timeScale, this.props.axisWidth, 0.80);
    });
  }

  /**
   * check if selectedDate will be within acceptable visible axis width
   *
   * @param {String} selectedDate
   * @param {Boolean} draggerB - draggerB being checked?
   * @returns {Object} output - return params used for dragger visibilty/updating axis
   * @returns {Boolean} output.withinRange - within visible range
   * @returns {Boolean} output.newDateInThePast - new date older?
   * @returns {Number} output.newDraggerDiff - difference of new dragger from selected
   */
  checkDraggerMoveOrUpdateScale = (selectedDate, draggerB) => {
    let draggerTimeState;
    let draggerPosition;

    if (draggerB) {
      draggerTimeState = this.state.draggerTimeStateB;
      draggerPosition = this.state.draggerPositionB;
    } else {
      draggerTimeState = this.state.draggerTimeState;
      draggerPosition = this.state.draggerPosition;
    }

    let timeScale = this.props.timeScale;
    let gridWidth = this.state.gridWidth;
    let axisWidth = this.props.axisWidth;

    let selectedDateMoment = moment.utc(selectedDate);
    let draggerDateMoment = moment.utc(draggerTimeState);

    let newDraggerDiff = selectedDateMoment.diff(draggerDateMoment, timeScale, true);
    let newDraggerPosition = draggerPosition + (newDraggerDiff * gridWidth);
    let newDateInThePast = selectedDateMoment < draggerDateMoment;
    let newDraggerWithinRangeCheck = newDraggerPosition <= (axisWidth - 80) && newDraggerPosition >= -26;

    return {
      withinRange: newDraggerWithinRangeCheck,
      newDateInThePast: newDateInThePast,
      newDraggerDiff: Math.abs(newDraggerDiff)
    };
  }

  componentDidUpdate(prevProps, prevState) {
    let {
      isDraggerDragging,
      isAnimationDraggerDragging,
      draggerTimeState,
      draggerTimeStateB
    } = this.state;
    let {
      dateA,
      dateB,
      draggerSelected,
      timeScale,
      axisWidth,
      compareModeActive,
      animStartLocationDate,
      animEndLocationDate
    } = this.props;

    // update animation draggers from date selector input changes
    if (!isAnimationDraggerDragging) {
      if (animStartLocationDate !== prevProps.animStartLocationDate ||
        animEndLocationDate !== prevProps.animEndLocationDate) {
        this.animationDraggerDateUpdate(animStartLocationDate, animEndLocationDate);
      }
    }

    // update timescale axis focus
    if (timeScale !== prevProps.timeScale) {
      let draggerDate;
      let leftOffset;
      if (this.state.wheelZoom === true) {
        draggerDate = this.state.hoverTime;
      } else {
        leftOffset = 0.90;
        if (draggerSelected === 'selected') {
          draggerDate = draggerTimeState;
        } else {
          draggerDate = draggerTimeStateB;
        }
      }
      this.updateScale(draggerDate, timeScale, null, leftOffset, true);
    }

    // update axis on browser width change
    if (axisWidth !== prevProps.axisWidth) {
      this.updateScale(null, timeScale, axisWidth);
    }

    // handle compare mode toggle change
    if (compareModeActive !== prevProps.compareModeActive) {
      // TURN ON COMPARE MODE
      if (compareModeActive) {
        this.setDraggerToTime(dateA);
        this.setDraggerToTime(dateB, true);
      } else {
        // TURN OFF COMPARE MODE
        if (draggerSelected === 'selected') {
          this.setState({
            draggerVisibleB: false
          });
        } else {
          this.setState({
            draggerVisible: false
          });
        }
      }
    }

    // handle switching A/B dragger axis focus if switched from A/B sidebar tabs
    if (compareModeActive && (draggerSelected !== prevProps.draggerSelected)) {
      if (draggerSelected === 'selected') {
        let draggerCheck = this.checkDraggerMoveOrUpdateScale(dateA);
        if (!draggerCheck.withinRange) {
          this.updateScaleWithOffset(dateA, timeScale, draggerCheck);
        }
      } else {
        let draggerCheck = this.checkDraggerMoveOrUpdateScale(dateB, true);
        if (!draggerCheck.withinRange) {
          this.updateScaleWithOffset(dateB, timeScale, draggerCheck);
        }
      }
    }

    if (!isDraggerDragging) {
      // handle A dragger change
      if (draggerTimeState !== dateA) {
        // check if draggerCheck will be within acceptable visible axis width
        let draggerCheck = this.checkDraggerMoveOrUpdateScale(dateA);
        if (draggerCheck.withinRange) {
          this.setDraggerToTime(dateA);
        } else {
          this.updateScaleWithOffset(dateA, timeScale, draggerCheck);
        }
      }

      // handle B dragger change
      if (draggerTimeStateB !== dateB) {
        // check if draggerCheck will be within acceptable visible axis width
        let draggerCheck = this.checkDraggerMoveOrUpdateScale(dateB, true);
        if (draggerCheck.withinRange) {
          this.setDraggerToTime(dateB, true);
        } else {
          this.updateScaleWithOffset(dateB, timeScale, draggerCheck);
        }
      }
    }
  }

  // update scale leftOffset helper
  updateScaleWithOffset = (date, timeScale, draggerCheck) => {
    let leftOffsetFixedCoeff = draggerCheck.newDraggerDiff > 5 ? 0.5 : draggerCheck.newDateInThePast ? 0.25 : 0.75;
    this.updateScale(date, timeScale, null, leftOffsetFixedCoeff);
  }

  // move draggerTimeState to inputTime
  setDraggerToTime = (inputTime, draggerB) => {
    let frontDate = this.state.currentTimeRange[0].rawDate;
    let backDate = this.state.currentTimeRange[this.state.currentTimeRange.length - 1].rawDate;
    let draggerTime = draggerB ? this.state.draggerTimeStateB : this.state.draggerTimeState;

    let isBetween = getIsBetween(inputTime, frontDate, backDate);

    let draggerVisible = false;
    let newDraggerPosition;
    if (isBetween) {
      draggerVisible = true;
    }
    let gridWidth = this.state.gridWidth;
    let timeScale = this.props.timeScale;
    let frontDateObj = moment.utc(frontDate);
    let pixelsToAddToDragger = Math.abs(frontDateObj.diff(draggerTime, timeScale, true) * gridWidth);
    let pixelsToAddToDraggerNew = Math.abs(frontDateObj.diff(inputTime, timeScale, true) * gridWidth);
    let pixelsToAddBasedOnFrontDate = pixelsToAddToDraggerNew - pixelsToAddToDragger;

    let isVisible = draggerB ? this.state.draggerVisibleB : this.state.draggerVisible;
    if (isVisible) {
      let draggerPosition = draggerB ? this.state.draggerPositionB : this.state.draggerPosition;
      newDraggerPosition = draggerPosition + pixelsToAddBasedOnFrontDate;
    } else {
      newDraggerPosition = pixelsToAddToDraggerNew + this.state.position - this.state.draggerWidth + this.state.transformX;
    }

    if (draggerB) {
      this.setState({
        draggerPositionB: newDraggerPosition,
        draggerVisibleB: draggerVisible,
        draggerTimeStateB: inputTime
      });
    } else {
      this.setState({
        draggerPosition: newDraggerPosition,
        draggerVisible: draggerVisible,
        draggerTimeState: inputTime
      });
    }
  }

  // handle start drag of axis
  handleStartDrag = () => {
    this.setState({
      isTimelineDragging: true
    });
  }

  // handle stop drag of axis
  // moved === false means an axis click
  handleStopDrag = (e, d) => {
    let {
      midPoint,
      position,
      transformX,
      leftBound,
      rightBound
    } = this.state;
    let { timeScale } = this.props;

    position = position - midPoint;
    let moved = false;
    // drag left OR drag right
    if (d.x < midPoint || d.x > midPoint) {
      moved = true;
    }

    // new left/right axis bounds
    leftBound = leftBound + (midPoint - d.x);
    rightBound = rightBound + (midPoint - d.x);
    if (timeScale === 'year') {
      leftBound = -midPoint * 2;
      rightBound = midPoint * 2;
    }

    this.setState({
      isTimelineDragging: false,
      leftBound,
      rightBound,
      moved: moved,
      position: midPoint,
      transformX: transformX + position
    });
  }

  // handle dragger dragging
  handleDragDragger = (draggerName, e, d) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }

    requestAnimationFrame(() => {
      var deltaX = d.deltaX;
      if (deltaX === 0) {
        return false;
      }
      let timeScale = this.props.timeScale;

      let options = timeScaleOptions[timeScale].timeAxis;
      let gridWidth = this.state.gridWidth;

      let axisWidth = this.props.axisWidth;
      let dragSentinelChangeNumber = this.state.dragSentinelChangeNumber;
      let dragSentinelCount = this.state.dragSentinelCount;

      let time;
      let draggerPosition;
      let draggerASelected = draggerName === 'selected';
      if (draggerASelected) { // 'selected is 'A' dragger
        draggerPosition = this.state.draggerPosition + deltaX;
        time = this.state.draggerTimeState;
      } else { // 'selectedB' is 'B' dragger
        draggerPosition = this.state.draggerPositionB + deltaX;
        time = this.state.draggerTimeStateB;
      }

      // update draggerTime based on deltaX from state draggerTime
      let draggerTimeValue = new Date(time).getTime();

      // only need to calculate difference in time unit for varying timescales - month and year
      let newDraggerTime;
      let diffZeroValues = options.scaleMs;
      if (!diffZeroValues) {
        // calculate based on frontDate due to varying number of days per month and per year (leapyears)
        let frontDate = this.state.currentTimeRange[0].rawDate;
        // ! -2 necessary from subtracting 2 from transformX in updateScale ?
        let draggerPositionRelativeToFrontDate = this.state.draggerWidth - 2 + draggerPosition - this.state.position - this.state.transformX;
        let gridWidthCoef = draggerPositionRelativeToFrontDate / gridWidth;
        let draggerDateAdded = moment.utc(frontDate).add((Math.floor(gridWidthCoef)), timeScale);

        let daysCount;
        if (timeScale === 'year') {
          daysCount = draggerDateAdded.isLeapYear() ? 366 : 365;
        } else if (timeScale === 'month') {
          daysCount = draggerDateAdded.daysInMonth();
        }
        let gridWidthCoefRemainder = gridWidthCoef - Math.floor(gridWidthCoef);
        let remainderMilliseconds = daysCount * 86400000 * gridWidthCoefRemainder;
        newDraggerTime = draggerDateAdded.add(remainderMilliseconds);
      } else {
        let diffFactor = diffZeroValues / gridWidth;
        newDraggerTime = draggerTimeValue + (diffFactor * deltaX);
      }

      // check if new dragger date is within valid date range
      let isBetweenValidTimeline = getIsBetween(newDraggerTime, this.props.timelineStartDateLimit, this.props.timelineEndDateLimit);
      if (isBetweenValidTimeline) {
        newDraggerTime = getISODateFormatted(newDraggerTime);
      } else {
        return false;
      }

      // handle drag timeline
      // // TODO: fix drag off current view - doesn't drag/update date of hover properly
      // if (draggerPosition < -draggerWidth) { // # handle drag timeline towards PAST
      //   // console.log('drag off view past', deltaX, (dragSentinelCount + deltaX), -dragSentinelChangeNumber)
      //   let position = this.state.position - deltaX;

      //   if ((dragSentinelCount + deltaX) < -dragSentinelChangeNumber) {
      //     // console.log('drag off view past UNSHIFT TILES')
      //     let overDrag = 0;
      //     if ((dragSentinelCount + deltaX) < -dragSentinelChangeNumber - dragSentinelChangeNumber) {
      //       overDrag = Math.abs((dragSentinelCount + deltaX) - -dragSentinelChangeNumber - -dragSentinelChangeNumber);
      //     }
      //     //# NEED TO PASS NEGATIVE OF DELTAX FOR UPDATE PANEL
      //     let { currentTimeRange,
      //                     deque,
      //         transformX,
      //           draggerVisible,
      //           draggerVisibleB,
      //             overDragGrids,
      //         draggerPositionRevision } = this.updatePanelDateRange(position, timeScale, -deltaX, draggerPosition, overDrag);

      //     this.setState({
      //       currentTimeRange: currentTimeRange,
      //       deque: deque,
      //       transformX: transformX,
      //       draggerPosition: -48,
      //       moved: true,
      //       position: position,
      //       dragSentinelCount: (dragSentinelCount + deltaX) - -dragSentinelChangeNumber + (overDragGrids * gridWidth),
      //     })
      //   } else {
      //     let newDragSentinelCount = dragSentinelCount > 0 ? (-dragSentinelChangeNumber + dragSentinelCount + deltaX) : dragSentinelCount + deltaX;

      //     // NEGATIVE DELTAX
      //     this.setState({
      //       draggerPosition: -48,
      //       moved: true,
      //       position: position,
      //       dragSentinelCount: newDragSentinelCount
      //     })
      //   }
      // } else if (draggerPosition > axisWidth - draggerWidth) { // handle drag timeline towards FUTURE
      //   // console.log('drag off view future', deltaX)
      //   let position = this.state.position - deltaX;

      //   if ((dragSentinelCount + deltaX) > dragSentinelChangeNumber) {

      //     let overDrag = 0;
      //     if ((dragSentinelCount + deltaX) > dragSentinelChangeNumber + dragSentinelChangeNumber) {
      //       overDrag = Math.abs((dragSentinelCount + deltaX) - dragSentinelChangeNumber - dragSentinelChangeNumber);
      //     }
      //     //# NEED TO PASS NEGATIVE OF DELTAX FOR UPDATE PANEL
      //     let { currentTimeRange,
      //                       deque,
      //           transformX,
      //             draggerVisible,
      //             draggerVisibleB,
      //               overDragGrids,
      //     draggerPositionRevision } = this.updatePanelDateRange(position, timeScale, -deltaX, draggerPosition, overDrag);

      //     this.setState({
      //       currentTimeRange: currentTimeRange,
      //       deque: deque,
      //       transformX: transformX,
      //       draggerPosition: axisWidth - 50,
      //       moved: true,
      //       position: position,
      //       dragSentinelCount: (dragSentinelCount + deltaX) - dragSentinelChangeNumber - (overDragGrids * gridWidth),
      //     })

      //   } else {
      //     let newDragSentinelCount = dragSentinelCount < 0 ? (dragSentinelChangeNumber + dragSentinelCount + deltaX) : dragSentinelCount + deltaX;

      //     // POSITIVE DELTAX
      //     this.setState({
      //       draggerPosition: axisWidth - 50,
      //       moved: true,
      //       position: position,
      //       dragSentinelCount: newDragSentinelCount
      //     })
      //   }
      // } else { // handle drag within axis view

      if (draggerASelected) {
        this.setState({
          draggerPosition: draggerPosition,
          draggerTimeState: newDraggerTime,
          moved: true
        }, this.props.changeDate(new Date(newDraggerTime), 'selected'));
      } else {
        this.setState({
          draggerPositionB: draggerPosition,
          draggerTimeStateB: newDraggerTime,
          moved: true
        }, this.props.changeDate(new Date(newDraggerTime), 'selectedB'));
      }
      // }
    });
  }

  changeDate = (time, draggerSelected) => {
    this.props.changeDate(time, draggerSelected);
  }

  // select dragger 'selected' or 'selectedB'
  selectDragger = (draggerName, e) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    if (draggerName !== this.props.draggerSelected) {
      this.props.onChangeSelectedDragger(draggerName);
    }
  }

  // display date based on hover grid tile
  displayDate = (date, leftOffset) => {
    requestAnimationFrame(() => {
      this.setState({
        hoverTime: date,
        leftOffset: leftOffset - this.props.parentOffset // relative location from parent bounding box of mouse hover position (i.e. BLUE LINE)
      });
    });
  }

  // show hover line
  showHoverOn = (e) => {
    if (!this.state.isAnimationDraggerDragging && !this.state.showDraggerTime) {
      if (e.target.className.animVal === 'grid') {
        if (this.state.showHoverLine !== true) {
          this.setState({
            showHoverLine: true
          });
        }
      }
    }
  }

  // hide hover line
  showHoverOff = () => {
    if (this.state.showHoverLine === true) {
      this.setState({
        showHoverLine: false
      });
    }
  }

  // toggle dragger time on/off
  toggleShowDraggerTime = (toggleBoolean) => {
    this.setState({
      showDraggerTime: toggleBoolean,
      showHoverLine: false,
      isDraggerDragging: toggleBoolean
    });
  }

  // update animation dragger helper function
  getAnimationLocateDateUpdate = (animLocationDate, animDraggerLocation, deltaX, { diffZeroValues, diffFactor, frontDate }) => {
    if (!diffZeroValues) { // month or year
      let {
        position,
        transformX,
        gridWidth
      } = this.state;
      let { timeScale } = this.props;

      let startDraggerPositionRelativeToFrontDate = animDraggerLocation - position - transformX + deltaX;
      let gridWidthCoef = startDraggerPositionRelativeToFrontDate / gridWidth;
      let draggerDateAdded = frontDate.add((Math.floor(gridWidthCoef)), timeScale);
      let daysCount;
      if (timeScale === 'year') {
        daysCount = draggerDateAdded.isLeapYear() ? 366 : 365;
      } else if (timeScale === 'month') {
        daysCount = draggerDateAdded.daysInMonth();
      }
      let gridWidthCoefRemainder = gridWidthCoef - Math.floor(gridWidthCoef);
      let remainderMilliseconds = daysCount * 86400000 * gridWidthCoefRemainder;
      let newLocationDate = draggerDateAdded.add(remainderMilliseconds);
      return new Date(newLocationDate);
    } else {
      let draggerTimeStartValue = new Date(animLocationDate).getTime();
      let newLocationDate = draggerTimeStartValue + (diffFactor * deltaX);
      return new Date(newLocationDate);
    }
  }

  // handle animation dragger drag change
  animationDraggerPositionUpdate = (startLocation, endLocation, isDragging) => {
    let {
      animationStartLocation,
      animationEndLocation,
      gridWidth
    } = this.state;
    let {
      timelineStartDateLimit,
      timelineEndDateLimit,
      animStartLocationDate,
      animEndLocationDate,
      timeScale
    } = this.props;

    // calculate new start and end positions
    let deltaXStart = startLocation - animationStartLocation;
    let animationStartLocationDate = animStartLocationDate;
    let deltaXEnd = endLocation - animationEndLocation;
    let animationEndLocationDate = animEndLocationDate;

    let startChanged = false;
    let endChanged = false;

    // if start or end dragger has moved
    if (deltaXStart !== 0 || deltaXEnd !== 0) {
      let diffZeroValues = timeScaleOptions[timeScale].timeAxis.scaleMs;
      // get startDate for diff calculation

      let frontDate;
      let diffFactor;
      if (!diffZeroValues) { // month or year diffFactor is not static, so require more calculation based on front date
        frontDate = moment.utc(this.state.currentTimeRange[0].rawDate);
      } else {
        diffFactor = diffZeroValues / gridWidth; // else known diffFactor used
      }

      let sharedAnimLocationUpdateParams = {
        diffZeroValues,
        diffFactor,
        frontDate
      };
      if (deltaXStart !== 0) { // update new start date
        startChanged = true;
        animationStartLocationDate = this.getAnimationLocateDateUpdate(
          animationStartLocationDate,
          animationStartLocation,
          deltaXStart,
          sharedAnimLocationUpdateParams
        );
      }
      if (deltaXEnd !== 0) { // update new end date
        endChanged = true;
        animationEndLocationDate = this.getAnimationLocateDateUpdate(
          animationEndLocationDate,
          animationEndLocation,
          deltaXEnd,
          sharedAnimLocationUpdateParams
        );
      }
    }

    let startDateLimit = new Date(timelineStartDateLimit);
    let endDateLimit = new Date(timelineEndDateLimit);
    let startDate = new Date(animationStartLocationDate);
    let endDate = new Date(animationEndLocationDate);

    // prevent draggers to be dragger BEFORE start date limit
    if (endDate < startDateLimit) {
      endLocation = animationEndLocation;
      animationEndLocationDate = startDateLimit;
    }
    if (startDate < startDateLimit) {
      startLocation = animationStartLocation;
      animationStartLocationDate = startDateLimit;
    }
    // prevent draggers to be dragger AFTER end date limit
    if (endDate > endDateLimit) {
      endLocation = animationEndLocation;
      animationEndLocationDate = endDateLimit;
    }
    if (startDate > endDateLimit) {
      startLocation = animationStartLocation;
      animationStartLocationDate = endDateLimit;
    }

    this.setState({
      isAnimationDraggerDragging: isDragging,
      animationStartLocation: startLocation,
      animationEndLocation: endLocation,
      showHoverLine: false,
      showDraggerTime: false,
      moved: !isDragging
    }, this.animationUpdateWidget(startChanged, endChanged, animationStartLocationDate, animationEndLocationDate));
  }

  // handles conditional functions for animation dragger updates
  animationUpdateWidget = (startChanged, endChanged, animationStartLocationDate, animationEndLocationDate) => {
    if (startChanged) {
      if (endChanged) {
        this.props.changeAnimStartAndEndDate(animationStartLocationDate, animationEndLocationDate);
      } else {
        this.props.changeAnimStartDate(animationStartLocationDate);
      }
    } else {
      this.props.changeAnimEndDate(animationEndLocationDate);
    }
  }

  // handle animation dragger location update and state update
  animationDraggerDateUpdate = (animationStartLocationDate, animationEndLocationDate) => {
    let {
      gridWidth,
      position,
      transformX
    } = this.state;
    let { timeScale } = this.props;

    let frontDate = moment.utc(this.state.currentTimeRange[0].rawDate);
    let startLocation = frontDate.diff(animationStartLocationDate, timeScale, true) * gridWidth;
    let endLocation = frontDate.diff(animationEndLocationDate, timeScale, true) * gridWidth;

    this.setState({
      animationStartLocation: position - startLocation + transformX,
      animationEndLocation: position - endLocation + transformX
    });
  }

  // handle svg blue line hover
  showHover = (e, itemDate, nextDate, index) => {
    e.preventDefault();
    e.stopPropagation();
    e.persist();
    requestAnimationFrame(() => {
      let {
        position,
        transformX,
        gridWidth
      } = this.state;

      let target = e.target;
      let clientX = e.clientX;
      let boundingClientRect = target.getBoundingClientRect();
      let xHoverPositionInCurrentGrid = Math.floor(clientX) - Math.floor(boundingClientRect.left);

      // let currentDateValue = moment.utc(itemDate).valueOf();
      let currentDateValue = new Date(itemDate).getTime();
      // let nextDateValue = moment.utc(nextDate).valueOf();
      let nextDateValue = new Date(nextDate).getTime();
      let diff = nextDateValue - currentDateValue;
      let diffFactor = diff / gridWidth;
      // let displayDate = moment.utc(currentDateValue + xHoverPositionInCurrentGrid * diffFactor);
      let displayDateValue = currentDateValue + xHoverPositionInCurrentGrid * diffFactor;

      // let isBetweenValidTimeline = getIsBetween(displayDate, this.props.timelineStartDateLimit, this.props.timelineEndDateLimit);
      let isBetweenValidTimeline = getIsBetween(displayDateValue, this.props.timelineStartDateLimit, this.props.timelineEndDateLimit);

      if (isBetweenValidTimeline) {
        let displayDateFormat = getISODateFormatted(displayDateValue);
        this.displayDate(displayDateFormat, clientX);
        this.setState({
          hoverLinePosition: index * gridWidth + xHoverPositionInCurrentGrid + transformX + position
        });
      }
    });
  }

  exportPosition = () => {
    this.props.getPosition(this.state.position);
  }

  render() {
    let {
      hasSubdailyLayers,
      draggerSelected,
      axisWidth,
      timeScale,
      compareModeActive,
      isAnimationWidgetOpen,
      animStartLocationDate,
      animEndLocationDate,
      timelineStartDateLimit,
      timelineEndDateLimit
    } = this.props;

    let {
      currentTimeRange,
      gridWidth,
      position,
      leftBound,
      rightBound,
      leftOffset,
      transformX,
      animationStartLocation,
      animationEndLocation,
      draggerPosition,
      draggerPositionB,
      draggerTimeState,
      draggerTimeStateB,
      draggerVisible,
      draggerVisibleB,
      isTimelineDragging,
      showDraggerTime,
      showHoverLine,
      hoverLinePosition,
      hoverTime
    } = this.state;

    // ! WINDOW.MOMENT FOR DEV DEBUG ONLY
    window.moment = moment;
    // console.log(this.props)
    return (
      <React.Fragment>
        <div id='wv-timeline-axis'
          style={{ width: `${axisWidth}px` }}
          onMouseUp={this.setLineTime}
          onWheel={this.wheelZoom}
          onMouseOver={this.showHoverOn}
          onMouseLeave={this.showHoverOff}
        >
          {currentTimeRange
            ? <svg className='inner'
              id='timeline-footer-svg'
              width={axisWidth}
              height={70}
              viewBox={`0 0 ${axisWidth} 75`}
              preserveAspectRatio='xMinYMin slice'>
              <defs>
                {/* clip axis grid text */}
                <clipPath id='textDisplay'>
                  <rect width='200' height='70' />
                </clipPath>
                {/* clip axis grid overflow */}
                <clipPath id='timelineBoundary'>
                  <rect width={axisWidth} height={70}></rect>
                </clipPath>
              </defs>
              <Draggable
                axis='x'
                onDrag={this.handleDrag}
                position={{ x: position, y: 0 }}
                onStart={this.handleStartDrag}
                onStop={this.handleStopDrag}
                bounds={{ left: leftBound, top: 0, bottom: 0, right: rightBound }}
              >
                <g>
                  <GridRange
                    showHover={this.showHover}
                    timeScale={timeScale}
                    displayDate={this.displayDate}
                    gridWidth={gridWidth}
                    timeRange={currentTimeRange}
                    transformX={transformX}
                  />
                </g>
              </Draggable>

              <HoverLine
                isTimelineDragging={isTimelineDragging}
                showHoverLine={showHoverLine}
                hoverLinePosition={hoverLinePosition}
              />

              {isAnimationWidgetOpen
                ? <TimelineRangeSelector
                  startLocation={animationStartLocation}
                  endLocation={animationEndLocation}
                  startLocationDate={animStartLocationDate}
                  endLocationDate={animEndLocationDate}
                  timelineStartDateLimit={timelineStartDateLimit}
                  timelineEndDateLimit={timelineEndDateLimit}
                  max={{ end: false, start: false, startOffset: -50, width: 50000 }}
                  pinWidth={5}
                  height={45}
                  onDrag={this.animationDraggerPositionUpdate}
                  onHover={this.showHoverOff}
                  // onRangeClick={this.setLineTime}
                  onRangeClick={() => console.log('onRangeClick')}
                  rangeOpacity={0.3}
                  rangeColor={'#45bdff'}
                  startColor={'#40a9db'}
                  startTriangleColor={'#fff'}
                  endColor={'#295f92'}
                  endTriangleColor={'#4b7aab'} />
                : null
              }

              <DraggerContainer
                draggerSelected={draggerSelected}
                transformX={transformX}
                toggleShowDraggerTime={this.toggleShowDraggerTime}
                handleDragDragger={this.handleDragDragger}
                selectDragger={this.selectDragger}
                compareModeActive={compareModeActive}
                draggerPosition={draggerPosition}
                draggerPositionB={draggerPositionB}
                draggerVisible={draggerVisible}
                draggerVisibleB={draggerVisibleB}
              />
            </svg>
            : null }

          {!isTimelineDragging
            ? <DateToolTip
              draggerSelected={draggerSelected}
              draggerPosition={draggerPosition}
              draggerPositionB={draggerPositionB}
              hasSubdailyLayers={hasSubdailyLayers}
              leftOffset={leftOffset}
              showDraggerTime={showDraggerTime}
              draggerTimeState={draggerTimeState}
              draggerTimeStateB={draggerTimeStateB}
              hoverTime={hoverTime}
              showHoverLine={showHoverLine}
              axisWidth={axisWidth}
            />
            : null
          }
        </div>
      </React.Fragment>
    );
  }
}

TimelineAxis.defaultProps = {
};
TimelineAxis.propTypes = {
  animEndLocationDate: PropTypes.object,
  animStartLocationDate: PropTypes.object,
  axisWidth: PropTypes.number,
  changeDate: PropTypes.func,
  changeTimeScale: PropTypes.func,
  compareModeActive: PropTypes.bool,
  draggerSelected: PropTypes.string,
  hasSubdailyLayers: PropTypes.bool,
  isAnimationWidgetOpen: PropTypes.bool,
  onChangeSelectedDragger: PropTypes.func,
  parentOffset: PropTypes.number,
  dateA: PropTypes.string,
  dateB: PropTypes.string,
  startDate: PropTypes.string,
  timeScale: PropTypes.string,
  timelineEndDateLimit: PropTypes.string,
  timelineStartDateLimit: PropTypes.string,
  // updateAnimationRange: PropTypes.func
};

export default TimelineAxis;
