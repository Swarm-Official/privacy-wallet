import logo from "../../assets/img/swarm-mark.png";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSnowflake } from "@fortawesome/free-solid-svg-icons";
import Utils from "../../utils/utils";
import APP_VERSION from "../../version";
import { SWARM_APP_NAME } from "../../utils/swarmNetwork";

type LogoProps = {
  onlyVersion: boolean;
  readOnly: boolean;
};

const Logo = ({ readOnly, onlyVersion }: LogoProps) => {
  return (
    <>
      <div style={{ color: "var(--color-zingo)", fontWeight: "bold", marginTop: 5, marginBottom: 10 }}>
        {SWARM_APP_NAME} v{APP_VERSION}
      </div>
      {!onlyVersion && (
        <div>
          <img src={logo} width="70" alt="logo" style={{ borderRadius: 5, marginRight: 10 }} />
          {readOnly && (
            <FontAwesomeIcon
              icon={faSnowflake}
              color={Utils.getCssVariable("--color-zingo")}
              style={{ height: 30, marginBottom: 20 }}
            />
          )}
        </div>
      )}
    </>
  );
};

export default Logo;
