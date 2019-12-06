import React, { Component } from 'react';
import PropTypes from 'prop-types';
import DateInputColumn from './input';
import util from '../../util/util';

/*
 * DateSelector used within Timeline and AnimationWidget.
 * It is a parent component for DateInputColumn(s)
 *
 * @class DateSelector
 */
class DateSelector extends Component {
  constructor(props) {
    super(props);
    this.state = {
      lastTab: null,
      tab: null,
      year: null,
      month: null,
      day: null,
      hour: null,
      minute: null,
      yearValid: true,
      monthValid: true,
      dayValid: true,
      hourValid: true,
      minuteValid: true
    };
  }

  /**
  * @desc add individual timeunit input
  *
  * @param {String} timeUnit
  * @param {String / Number} input
  * @returns {void}
  */
  updateTimeUnitInput = (timeUnit, input) => {
    this.setState({
      [timeUnit]: input
    }, this.updateDate);
  }

  /**
  * @desc set focused tab
  *
  * @param {Number} input
  * @returns {void}
  */
  setFocusedTab = (tab) => {
    this.setState({ tab });
  }

  /**
  * @desc change tab
  *
  * @param {Number} index
  * @returns {void}
  */
  changeTab = (index) => {
    const { subDailyMode } = this.props;
    const { tab } = this.state;
    let nextTab = index;
    let maxTab;
    if (subDailyMode) {
      maxTab = 5;
    } else {
      maxTab = 3;
    }
    if (index > tab) {
      // past max tab
      if (index > maxTab) {
        nextTab = 1;
      }
    } else {
      // below min tab
      if (index < 1) {
        nextTab = maxTab;
      }
    }
    this.setState({
      tab: nextTab,
      lastTab: this.state.tab
    });
  }

  /**
  * @desc check valid date with potential temporarily invalid dates
  * @desc Example: temporary invalid date example would be starting with FEB 22
  * @desc changing to invalid FEB 31 (31 is a valid day, but invalid for FEB),
  * @desc and changing to valid OCT 31 - temp values are retained until valid date
  *
  * @param {String} date
  * @param {Boolean} isRollDate
  * @returns {Object Date or Boolean} valid date or false
  */
  updateDateCheck = (date, isRollDate) => {
    const { minDate, maxDate } = this.props;
    const { year, month, day, hour, minute } = this.state;
    const timePrefix = ['year', 'month', 'day', 'hour', 'minute'];
    const tabToCheck = timePrefix[this.state.lastTab - 1];
    const inputDate = new Date(date);
    const tempDay = day || date.getUTCDate();
    let dateWithinRange;
    let validDate = true;
    let triggeredInvalid = false;

    if (isRollDate) {
      dateWithinRange = inputDate > minDate && inputDate <= maxDate;
      date = inputDate;
      validDate = true;
    } else {
      // conditional logic allows temporary place holder values to be validated
      // in the event other inputs are invalid, temp values remain without date change
      if (year) {
        date = new Date(new Date(date).setUTCFullYear(year));
        if (tabToCheck === 'year') {
          const yearDateWithinRange = date < minDate || date > maxDate;
          triggeredInvalid = yearDateWithinRange;
        }
      }
      if (day && !month) {
        const maxDayDate = new Date(
          date.getUTCFullYear(),
          date.getUTCMonth() + 1,
          0
        ).getDate();

        let dateCheck;
        if (day <= maxDayDate) {
          date = new Date(new Date(date).setUTCDate(day));
          dateCheck = new Date(new Date(inputDate).setUTCDate(day));
        } else {
          date = new Date(new Date(date).setUTCDate(maxDayDate));
          validDate = false;
          dateCheck = new Date(new Date(inputDate).setUTCDate(maxDayDate));
        }

        if (tabToCheck === 'day') {
          const dayDateWithinRange = !validDate || (dateCheck < minDate || dateCheck > maxDate);
          triggeredInvalid = dayDateWithinRange;
        }
      }

      if (month) {
        const realMonth = util.stringInArray(util.monthStringArray, month);
        const maxDatePrev = new Date(
          date.getUTCFullYear(),
          date.getUTCMonth() + 1,
          0
        ).getDate();

        const maxDateNew = new Date(
          date.getUTCFullYear(),
          realMonth + 1,
          0
        ).getDate();

        if (maxDatePrev > maxDateNew && tempDay > maxDateNew) {
          validDate = false;
        }

        let dateCheck;
        if (day && month) {
          dateCheck = new Date(inputDate);
          date = new Date(new Date(date).setUTCDate(1));
          date = new Date(new Date(date).setUTCMonth(realMonth));
          dateCheck = new Date(new Date(dateCheck).setUTCDate(1));
          dateCheck = new Date(new Date(dateCheck).setUTCMonth(realMonth));
        } else {
          const maxDayDate = new Date(
            date.getUTCFullYear(),
            date.getUTCMonth() + 1,
            0
          ).getDate();

          if (inputDate.getDate() > maxDayDate) {
            validDate = false;
          }
          dateCheck = new Date(new Date(inputDate).setUTCMonth(realMonth));
          date = new Date(new Date(date).setUTCMonth(realMonth));
        }

        if (tabToCheck === 'month') {
          const monthDateWithinRange = !validDate || (dateCheck < minDate || dateCheck > maxDate);
          triggeredInvalid = monthDateWithinRange;
        }
      }

      if (day && month) {
        const maxDayDate = new Date(
          date.getUTCFullYear(),
          date.getUTCMonth() + 1,
          0
        ).getDate();

        let dateCheck;
        if (day <= maxDayDate) {
          dateCheck = new Date(inputDate);
          const realMonth = util.stringInArray(util.monthStringArray, month);
          date = new Date(new Date(date).setUTCDate(day));
          dateCheck = new Date(new Date(date).setUTCDate(1));
          dateCheck = new Date(new Date(dateCheck).setUTCMonth(realMonth));
          dateCheck = new Date(new Date(dateCheck).setUTCDate(day));
        } else {
          date = new Date(new Date(date).setUTCDate(maxDayDate));
          validDate = false;
          dateCheck = new Date(new Date(inputDate).setUTCDate(maxDayDate));
        }

        if (tabToCheck === 'month') {
          const monthDateWithinRange = !validDate || (dateCheck < minDate || dateCheck > maxDate);
          triggeredInvalid = monthDateWithinRange;
        } else if (tabToCheck === 'day') {
          const dayDateWithinRange = !validDate || (dateCheck < minDate || dateCheck > maxDate);
          triggeredInvalid = dayDateWithinRange;
        }
      }

      if (hour) {
        date = new Date(new Date(date).setUTCHours(hour));
      }

      if (minute) {
        date = new Date(new Date(date).setUTCMinutes(minute));
      }
      dateWithinRange = date > minDate && date <= maxDate;
    }

    // updateDate at this stage can still be invalid with pending timeunit changes
    const updatedDate = date.toISOString() !== this.props.date.toISOString();
    const newDateWithinRange = dateWithinRange && updatedDate;
    if (validDate && (isRollDate || newDateWithinRange)) {
      return date;
    } else {
      // only set invalid if updated and tabToCheck was offending invalid value
      if (updatedDate) {
        const timeValid = `${tabToCheck}Valid`;
        // time specific validation (e.g., 'yearValid') for use in inputs
        this.setState({
          [timeValid]: !triggeredInvalid
        });
      } else {
        return date;
      }
      return false;
    }
  }

  /**
  * @desc update date with newDate if valid from check and then reset temp time values
  *
  * @param {String} date
  * @param {Boolean} isRollDate
  * @returns {void}
  */
  updateDate = (date = this.props.date, isRollDate = false) => {
    const { id, onDateChange } = this.props;
    const newDate = this.updateDateCheck(date, isRollDate);

    if (newDate) {
      onDateChange(newDate, id);
      // clear the pending timeunit inputs
      this.setState({
        year: null,
        month: null,
        day: null,
        hour: null,
        minute: null,
        yearValid: true,
        monthValid: true,
        dayValid: true,
        hourValid: true,
        minuteValid: true
      });
    }
  }

  shouldComponentUpdate(prevProps, prevState) {
    const {
      date,
      subDailyMode,
      maxDate,
      minDate
    } = this.props;
    const {
      year,
      month,
      day,
      hour,
      minute,
      yearValid,
      monthValid,
      dayValid,
      hourValid,
      minuteValid,
      tab
    } = this.state;

    const updateCheck = (
      year === prevState.year &&
      month === prevState.month &&
      day === prevState.day &&
      hour === prevState.hour &&
      minute === prevState.minute &&
      yearValid === prevState.yearValid &&
      monthValid === prevState.monthValid &&
      dayValid === prevState.dayValid &&
      hourValid === prevState.hourValid &&
      minuteValid === prevState.minuteValid &&
      tab === prevState.tab &&
      date.getTime() === prevProps.date.getTime() &&
      subDailyMode === prevProps.subDailyMode &&
      maxDate.getTime() === prevProps.maxDate.getTime() &&
      minDate.getTime() === prevProps.minDate.getTime()
    );
    return !updateCheck;
  }

  render() {
    const {
      date,
      maxDate,
      minDate,
      fontSize,
      idSuffix,
      subDailyMode
    } = this.props;
    const {
      year,
      month,
      day,
      hour,
      minute,
      yearValid,
      monthValid,
      dayValid,
      hourValid,
      minuteValid,
      tab
    } = this.state;
    const sharedProps = {
      date,
      updateDate: this.updateDate,
      setFocusedTab: this.setFocusedTab,
      changeTab: this.changeTab,
      maxDate,
      minDate,
      fontSize,
      updateTimeUnitInput: this.updateTimeUnitInput
    };
    return (
      <div className="wv-date-selector-widget">
        <DateInputColumn
          {...sharedProps}
          type="year"
          inputId={'year-' + idSuffix}
          value={year || date.getUTCFullYear()}
          tabIndex={1}
          focused={tab === 1}
          isValid={yearValid}
        />
        <DateInputColumn
          {...sharedProps}
          type="month"
          inputId={'month-' + idSuffix}
          value={month || util.monthStringArray[date.getUTCMonth()]}
          tabIndex={2}
          focused={tab === 2}
          isValid={monthValid}
        />
        <DateInputColumn
          {...sharedProps}
          type="day"
          inputId={'day-' + idSuffix}
          value={day || util.pad(date.getUTCDate(), 2, '0')}
          tabIndex={3}
          focused={tab === 3}
          isValid={dayValid}
        />
        { subDailyMode && (
          <React.Fragment>
            <DateInputColumn
              {...sharedProps}
              type="hour"
              inputId={'hour-' + idSuffix}
              value={hour || util.pad(date.getUTCHours(), 2, '0')}
              tabIndex={4}
              focused={tab === 4}
              isValid={hourValid}
            />
            <div className="input-time-divider">:</div>
            <DateInputColumn
              {...sharedProps}
              type="minute"
              value={minute || util.pad(date.getUTCMinutes(), 2, '0')}
              inputId={'minute-' + idSuffix}
              tabIndex={5}
              focused={tab === 5}
              isValid={minuteValid}
            />
            <div className="input-time-zmark">Z</div>
          </React.Fragment>
        )
        }
      </div>
    );
  }
}
DateSelector.defaultProps = {
  fontSize: 15
};
DateSelector.propTypes = {
  date: PropTypes.object,
  fontSize: PropTypes.number,
  id: PropTypes.string,
  idSuffix: PropTypes.string,
  maxDate: PropTypes.object,
  minDate: PropTypes.object,
  onDateChange: PropTypes.func,
  subDailyMode: PropTypes.bool
};

export default DateSelector;
