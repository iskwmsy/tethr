import {reactive, readonly, Ref, ref, shallowRef, watch} from 'vue'

import {connectCamera, Tethr} from '../src'
import {BasePropType} from '../src/Tethr/Tethr'

const TransparentPng =
	'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='

export interface TethrProp<T extends BasePropType[keyof BasePropType]> {
	writable: boolean
	value: T | null
	updating: boolean
	update: (value: T) => void
	supportedValues: null | T[]
}

export function useTethrProp<Name extends keyof BasePropType>(
	camera: Ref<Tethr | null>,
	name: Name
) {
	const prop = reactive({
		writable: false,
		value: null,
		updating: false,
		update: () => null,
		supportedValues: null,
	}) as TethrProp<BasePropType[Name]>

	watch(camera, async cam => {
		if (!cam) return

		const desc = await cam.getDesc(name)

		prop.writable = desc.writable
		prop.value = desc.value

		prop.update = async (value: any) => {
			prop.updating = true
			prop.value = (await cam.set(name, value)).value
			prop.updating = false
		}

		if (desc.writable) {
			prop.supportedValues = desc.supportedValues
		}
	})

	return readonly(prop)
}

export function useTethr() {
	const camera = shallowRef<Tethr | null>(null)

	const connected = ref(false)

	const deviceInfo = ref('')

	const liveviewURL = ref(TransparentPng)
	const lastPictureURL = ref(TransparentPng)

	async function toggleCameraConnection() {
		if (camera.value && camera.value.opened) {
			await camera.value.close()
		} else {
			if (!camera.value) {
				camera.value = await connectCamera()
				connected.value = true
			}
			if (!camera.value.open) {
				await camera.value.open()
			}

			deviceInfo.value = JSON.stringify(await camera.value.getDeviceInfo())
			;(window as any).cam = camera.value
		}
	}

	async function runAutoFocus() {
		await camera.value?.runAutoFocus()
	}

	async function takePicture() {
		if (!camera.value) return

		const url = await camera.value.takePicture()
		if (url) lastPictureURL.value = url
	}

	const liveviewing = ref(false)

	async function toggleLiveview() {
		liveviewing.value = !liveviewing.value

		if (!camera.value) return

		if (liveviewing.value) {
			await camera.value.startLiveView()
			updateLiveview()
		} else {
			await camera.value.stopLiveView()
		}

		async function updateLiveview() {
			if (!liveviewing.value || !camera.value) return

			try {
				const url = await camera.value.getLiveView()
				if (url) {
					URL.revokeObjectURL(liveviewURL.value)
					liveviewURL.value = url
				}
			} finally {
				requestAnimationFrame(updateLiveview)
			}
		}
	}

	return {
		connected,
		deviceInfo,

		// DPC
		exposureMode: useTethrProp(camera, 'exposureMode'),
		aperture: useTethrProp(camera, 'aperture'),
		shutterSpeed: useTethrProp(camera, 'shutterSpeed'),
		iso: useTethrProp(camera, 'iso'),
		whiteBalance: useTethrProp(camera, 'whiteBalance'),
		colorTemperature: useTethrProp(camera, 'colorTemperature'),

		liveviewURL,
		liveviewing: readonly(liveviewing),
		lastPictureURL,
		runAutoFocus,
		toggleCameraConnection,
		toggleLiveview,
		takePicture,
	}
}
