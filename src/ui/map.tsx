import * as React from 'react';

export interface MapCoordinates {
  lat: number;
  lng: number;
}

export interface MapPickerProps {
  value?: MapCoordinates | null;
  onChange?: (coords: MapCoordinates | null) => void;
  onAddressSelect?: (address: string) => void;
  disabled?: boolean;
  className?: string;
  defaultZoneCenter?: MapCoordinates;
  addressText?: string;
}

export function MapSkeleton({ className }: { className?: string }) {
  return null;
}

export function MapPicker(_props: MapPickerProps) {
  return null;
}
