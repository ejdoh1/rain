import React, { useState, useEffect, useRef } from "react";
import { Map, TileLayer, Marker, GeoJSON } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import "leaflet-arrowheads";
import useInterval from "use-interval";
import Control from "@skyeer/react-leaflet-custom-control";
import Card from "@material-ui/core/Card";
import CardContent from "@material-ui/core/CardContent";
import { Line } from "rc-progress";
import Moment from "react-moment";
import * as d3 from "d3";

delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl: require("leaflet/dist/images/marker-icon-2x.png"),
  iconUrl: require("leaflet/dist/images/marker-icon.png"),
  shadowUrl: require("leaflet/dist/images/marker-shadow.png"),
});

const tilesUrl =
  "https://radar-tiles.service.bom.gov.au/tiles/{timestep}/{z}/{x}/{y}.png";

const urlRainDir =
  "https://osiu38kob3.execute-api.ap-southeast-2.amazonaws.com/dev/rain-direction?loc=";

const urlBomCapabilities =
  "https://api.weather.bom.gov.au/v1/rainradarlayer/capabilities";

const tileUrlMap =
  "https://cartodb-basemaps-{s}.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png";

// const tileUrlMap =
//   "https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"

const attribution =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const urlU = "https://rain-rain.s3-ap-southeast-2.amazonaws.com/u.asc";
const urlV = "https://rain-rain.s3-ap-southeast-2.amazonaws.com/v.asc";

const urlVector =
  "https://ihcantabria.github.io/Leaflet.CanvasLayer.Field/dist/leaflet.canvaslayer.field.js";

export default function App() {
  const [marker, setMarker] = useState({ lat: 0, lng: 0 });
  const [zoom] = useState(5);
  const [bomUrl, setBomUrl] = useState("");
  const [bomUrlFade, setBomUrlFade] = useState("");
  const [linestring, setLinestring] = useState("");
  const [rainDirUpdated, setRainDirUpdated] = useState("");
  const [pc, setPc] = useState("0");
  const [timestep, setTimestep] = useState("");
  let [count, setCount] = React.useState(0);
  const mapRef = useRef();

  useEffect(() => {
    if (marker.lat === 0) return;
    fetch(urlRainDir + marker.lat + "," + marker.lng)
      .then((r) => r.json())
      .then((d) => {
        setLinestring(d.linestring);
        setRainDirUpdated(d.index.inputs[1].png.split("/")[1].split(".")[0]);
      });
  }, [marker]);

  useEffect(() => {
    const script = document.createElement("script");
    script.src = urlVector;
    script.async = true;
    document.body.appendChild(script);
    const map = mapRef.current.leafletElement;
    d3.text(urlU).then((u) => {
      d3.text(urlV).then((v) => {
        let vf = L.VectorField.fromASCIIGrids(u, v);
        const animation = L.canvasLayer
          .vectorFieldAnim(vf, {
            paths: 1000,
            fade: 0.97,
            maxAge: 50,
            velocityScale: 1 / 2000,
            color: "rgba(255, 255, 255, 0.7)",
          })
          .addTo(map);
        const direction = L.canvasLayer.scalarField(
          vf.getScalarField("directionFrom"),
          {
            type: "vector",
            color: "white",
            vectorSize: 25,
            arrowDirection: "from",
          }
        );
        L.control
          .layers(
            {},
            {
              Flow: animation,
              Arrows: direction,
            },
            {
              position: "bottomleft",
              collapsed: false,
            }
          )
          .addTo(map);
      });
    });
  }, []);

  useInterval(() => {
    fetch(urlBomCapabilities)
      .then((r) => r.json())
      .then((d) => {
        const ts = d.data.timesteps[count];
        setTimestep(ts + "Z");
        const pc = (count / (d.data.timesteps.length - 1)) * 100.0;
        setPc(pc);
        setBomUrl(tilesUrl.replace("{timestep}", ts));
        setTimeout(() => {
          setBomUrlFade(tilesUrl.replace("{timestep}", ts));
        }, 300);
        if (count === d.data.timesteps.length - 1) {
          setCount(0);
        } else {
          setCount(count + 1);
        }
      });
  }, 1000);

  const toMinutes = (d) => {
    const p = d.split(":");
    let m = "";
    m = p[0];
    if (p.length === 3) m = 60 * parseInt(p[0], 10) + parseInt(p[1]);
    let ext = " minutes ago";
    if (m === "1") ext = " minute ago";
    return m + ext;
  };

  return (
    <Map
      ref={mapRef}
      center={[-28, 132]}
      zoom={zoom}
      style={{
        width: "100%",
        position: "absolute",
        top: 0,
        bottom: 0,
      }}
      updateWhenZooming={false}
      updateWhenIdle={true}
      preferCanvas={true}
      minZoom={2}
      maxBounds={L.latLngBounds(L.latLng(-47, 109), L.latLng(-7, 158.1))}
      onClick={({ latlng }) => setMarker(latlng)}
    >
      <TileLayer maxZoom={10} attribution={attribution} url={tileUrlMap} />
      {bomUrl !== "" ? <TileLayer maxZoom={10} url={bomUrl} /> : <></>}
      {bomUrlFade !== "" ? <TileLayer maxZoom={10} url={bomUrlFade} /> : <></>}
      {marker.lat !== 0 ? <Marker position={marker}></Marker> : <></>}
      {linestring !== "" ? (
        <GeoJSON
          key={JSON.stringify(linestring)}
          data={linestring}
          arrowheads={{ fill: true, size: "30%" }}
          style={{ color: "green" }}
        />
      ) : (
        <></>
      )}
      {timestep !== "" ? (
        <Control position="topright">
          <Card style={{ minWidth: 100 }}>
            <CardContent>
              <Line percent={pc} strokeWidth="8" strokeColor="black" />
              <Moment
                filter={toMinutes}
                utc
                durationFromNow
                parse="YYYYMMDDhhmm"
              >
                {timestep}
              </Moment>
              {rainDirUpdated !== "" ? (
                <div>
                  Updated:
                  <Moment
                    filter={toMinutes}
                    utc
                    durationFromNow
                    parse="YYYYMMDDhhmm"
                  >
                    {rainDirUpdated}
                  </Moment>
                </div>
              ) : (
                <></>
              )}
            </CardContent>
          </Card>
        </Control>
      ) : (
        <></>
      )}
    </Map>
  );
}
