/**
 * Schedule Controllers Index
 * Exports all schedule-related controllers and creates a composed controller
 */

export * from "./base-schedule.controller";
export * from "./schedule-crud.controller";
export * from "./schedule-route.controller";
export * from "./schedule-weather.controller";
export * from "./schedule-statistics.controller";

import { BaseScheduleController } from "./base-schedule.controller";
import { ScheduleCrudController } from "./schedule-crud.controller";
import { ScheduleRouteController } from "./schedule-route.controller";
import { ScheduleWeatherController } from "./schedule-weather.controller";
import { ScheduleStatisticsController } from "./schedule-statistics.controller";

/**
 * Composed Schedule Controller
 * Combines all schedule-related functionality using service composition pattern
 */
export class ScheduleController {
  private baseController: BaseScheduleController;
  private crudController: ScheduleCrudController;
  private routeController: ScheduleRouteController;
  private weatherController: ScheduleWeatherController;
  private statisticsController: ScheduleStatisticsController;

  constructor() {
    this.baseController = new BaseScheduleController();
    this.crudController = new ScheduleCrudController();
    this.routeController = new ScheduleRouteController();
    this.weatherController = new ScheduleWeatherController();
    this.statisticsController = new ScheduleStatisticsController();
  }

  // Base operations
  getSchedules = this.baseController.getSchedules.bind(this.baseController);
  getScheduleById = this.baseController.getScheduleById.bind(
    this.baseController
  );

  // CRUD operations
  updateSchedule = this.crudController.updateSchedule.bind(this.crudController);
  deleteSchedule = this.crudController.deleteSchedule.bind(this.crudController);

  // Route operations
  getRoutePlan = this.routeController.getRoutePlan.bind(this.routeController);
  updateRoutePlan = this.routeController.updateRoutePlan.bind(
    this.routeController
  );
  recalculateRoute = this.routeController.recalculateRoute.bind(
    this.routeController
  );

  // Weather operations
  getWeatherData = this.weatherController.getWeatherData.bind(
    this.weatherController
  );
  updateWeatherData = this.weatherController.updateWeatherData.bind(
    this.weatherController
  );
  getWeatherWarnings = this.weatherController.getWeatherWarnings.bind(
    this.weatherController
  );
  getWeatherForecast = this.weatherController.getWeatherForecast.bind(
    this.weatherController
  );

  // Statistics operations
  getStatistics = this.statisticsController.getStatistics.bind(
    this.statisticsController
  );
}

// Export singleton instance
export const scheduleController = new ScheduleController();
