package com.weatherapp.backend.savedlocation

import com.weatherapp.backend.alert.WarningSeverity
import java.time.Instant

data class SavedLocation(
    val id: Long,
    val userId: Long,
    val name: String,
    val latitude: Double,
    val longitude: Double,
    val terytCode: String?,
    /** Where the user put this place in their list; ties break on createdAt. */
    val position: Int,
    /**
     * The lowest warning level worth waking this device for, at this place.
     *
     * Governs delivery only (decision 25). A warning below it is still matched,
     * still stored and still shown on the place's screen - the threshold says
     * "do not wake me for this", not "hide this from me".
     */
    val minSeverity: WarningSeverity,
    val createdAt: Instant,
)
