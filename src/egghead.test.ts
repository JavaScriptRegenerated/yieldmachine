/**
 * @jest-environment jsdom
 */

import { on, start } from "./index";

describe("Egghead", () => {
  describe("Space heater", () => {
    function SpaceHeater() {
      function* PoweredOff() {
        yield on("TOGGLE_POWER", PoweredOn);
      }
      function* PoweredOn() {
        yield on("TOGGLE_POWER", PoweredOff);

        function* LowHeat() {
          yield on("TOGGLE_HEAT", HighHeat);
        }
        function* HighHeat() {
          yield on("TOGGLE_HEAT", HighHeat);
        }

        return LowHeat;
      }

      return PoweredOff;
    }

    it("works as expected", () => {
      const heater = start(SpaceHeater);
  
      expect(heater.value.state).toEqual("PoweredOff");
      
      heater.next("TOGGLE_POWER");
      expect(heater.value.state).toEqual({ "PoweredOn": "LowHeat" });
      
      heater.next("TOGGLE_HEAT");
      expect(heater.value.state).toEqual({ "PoweredOn": "HighHeat" });
      
      heater.next("TOGGLE_POWER");
      expect(heater.value.state).toEqual("PoweredOff");
    });
  });

});
