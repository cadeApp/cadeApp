'use client';

// Fixture: Archivo "use client" importando de next/server (debe estar permitido y no dar falso positivo) (Hallazgo 7)
import type { NextRequest } from 'next/server';

export type ProbeType = NextRequest;
