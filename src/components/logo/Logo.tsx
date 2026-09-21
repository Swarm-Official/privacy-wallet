import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSnowflake } from "@fortawesome/free-solid-svg-icons";
import Utils from "../../utils/utils";
import APP_VERSION from "../../version";
import { SWARM_APP_NAME } from "../../utils/swarmNetwork";
import HiveBee from "./HiveBee";

type LogoProps = {
  onlyVersion: boolean;
  readOnly: boolean;
};

const Logo = ({ readOnly, onlyVersion }: LogoProps) => {
  return (
    <>
      <div
        style={{
          fontFamily: "var(--font-display)",
          color: "var(--swarm-text)",
          fontWeight: 600,
          letterSpacing: "0.02em",
          marginTop: 5,
          marginBottom: 10,
        }}
      >
        {SWARM_APP_NAME} v{APP_VERSION}
      </div>
      {!onlyVersion && (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <HiveBee size={70} animated />
          {readOnly && (
            <FontAwesomeIcon
              icon={faSnowflake}
              color={Utils.getCssVariable("--swarm-clear-blue")}
              style={{ height: 30, marginBottom: 20 }}
            />
          )}
        </div>
      )}
    </>
  );
};

export default Logo;
