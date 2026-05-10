import { ToggleButton, ToggleButtonGroup, Box } from '@mui/material';
import {
  Thermostat as TempIcon,
  Opacity as HumidityIcon,
  Grass as SoilIcon,
  WbSunny as LightIcon,
} from '@mui/icons-material';

const sensors = [
  { id: 'temperature', label: 'Temperature', icon: <TempIcon />, unit: '°C' },
  { id: 'humidity', label: 'Humidity', icon: <HumidityIcon />, unit: '%' },
  { id: 'soil_moisture', label: 'Soil Moisture', icon: <SoilIcon />, unit: '%' },
  { id: 'light_intensity', label: 'Light', icon: <LightIcon />, unit: 'lux' },
];

interface SensorSelectorProps {
  selected: string;
  onSelect: (sensorType: string) => void;
}

const SensorSelector: React.FC<SensorSelectorProps> = ({ selected, onSelect }) => {
  return (
    <Box sx={{ mb: 2 }}>
      <ToggleButtonGroup
        value={selected}
        exclusive
        onChange={(_, val) => val && onSelect(val)}
        aria-label="sensor type"
        size="small"
      >
        {sensors.map((sensor) => (
          <ToggleButton key={sensor.id} value={sensor.id} aria-label={sensor.label}>
            {sensor.icon}
            <Box component="span" sx={{ ml: 1, display: { xs: 'none', sm: 'inline' } }}>
              {sensor.label}
            </Box>
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </Box>
  );
};

export default SensorSelector;