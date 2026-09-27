import path from "path";
import { register } from "tsconfig-paths";

register({
  baseUrl: path.resolve(__dirname, "../dist"),
  paths: {
    "@/*": ["*"],
  },
});
