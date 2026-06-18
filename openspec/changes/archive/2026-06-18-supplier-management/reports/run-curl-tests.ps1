# Supplier-management curl endpoint tests (section 12)
$Base = "http://localhost:3000"
$Results = @()

function Log($name, $status, $detail) {
  $script:Results += [PSCustomObject]@{ Test = $name; Status = $status; Detail = $detail }
  Write-Host "[$status] $name - $detail"
}

function Get-Json($uri, $method = "GET", $body = $null) {
  $params = @{ Uri = $uri; Method = $method; ContentType = "application/json" }
  if ($body) { $params.Body = ($body | ConvertTo-Json -Depth 5) }
  try {
    $r = Invoke-WebRequest @params -UseBasicParsing
    return @{ Status = $r.StatusCode; Body = ($r.Content | ConvertFrom-Json) }
  } catch {
    $resp = $_.Exception.Response
    if ($resp) {
      $reader = New-Object System.IO.StreamReader($resp.GetResponseStream())
      $content = $reader.ReadToEnd()
      try { $json = $content | ConvertFrom-Json } catch { $json = $content }
      return @{ Status = [int]$resp.StatusCode; Body = $json }
    }
    throw
  }
}

# 12.1 baseline
$baseline = Get-Json "$Base/api/admin/suppliers"
Log "12.1 baseline list" "OK" "total=$($baseline.Body.data.total)"

# 12.2 GET list + filters
$r = Get-Json "$Base/api/admin/suppliers?page=1&pageSize=5"
if ($r.Status -eq 200 -and $r.Body.success) { Log "GET list" "PASS" "200 envelope OK" } else { Log "GET list" "FAIL" $r.Status }

$r = Get-Json "$Base/api/admin/suppliers?search=Curl&status=Active"
if ($r.Status -eq 200) { Log "GET search+status" "PASS" "200" } else { Log "GET search+status" "FAIL" $r.Status }

$r = Get-Json "$Base/api/admin/suppliers?pageSize=999"
if ($r.Body.data.pageSize -eq 100) { Log "GET pageSize clamp" "PASS" "pageSize=100" } else { Log "GET pageSize clamp" "FAIL" "pageSize=$($r.Body.data.pageSize)" }

$r = Get-Json "$Base/api/admin/suppliers/abc"
if ($r.Status -eq 400 -and $r.Body.error.code -eq "VALIDATION_ERROR") { Log "GET invalid id" "PASS" "400 VALIDATION_ERROR" } else { Log "GET invalid id" "FAIL" "status=$($r.Status)" }

$r = Get-Json "$Base/api/admin/suppliers/99999"
if ($r.Status -eq 404 -and $r.Body.error.code -eq "SUPPLIER_NOT_FOUND") { Log "GET not found" "PASS" "404 SUPPLIER_NOT_FOUND" } else { Log "GET not found" "FAIL" "status=$($r.Status)" }

# 12.3 POST create
$createBody = @{
  name = "Curl Test Supplier $(Get-Date -Format 'HHmmss')"
  contactName = "Test User"
  contactEmail = "test@curl.com"
  contactPhone = "123456"
  status = "Active"
}
$r = Get-Json "$Base/api/admin/suppliers" "POST" $createBody
if ($r.Status -eq 201 -and $r.Body.data.name -eq $createBody.name) {
  $createdId = $r.Body.data.id
  Log "POST create" "PASS" "201 id=$createdId"
} else {
  Log "POST create" "FAIL" "status=$($r.Status)"
  $createdId = $null
}

# 12.2 GET by id
if ($createdId) {
  $r = Get-Json "$Base/api/admin/suppliers/$createdId"
  if ($r.Status -eq 200 -and $r.Body.data.id -eq $createdId) { Log "GET by id" "PASS" "200" } else { Log "GET by id" "FAIL" $r.Status }
}

# 12.4 PATCH update incl Blocked
if ($createdId) {
  $orig = Get-Json "$Base/api/admin/suppliers/$createdId"
  $patchBody = @{ status = "Blocked"; notes = "curl patch test" }
  $r = Get-Json "$Base/api/admin/suppliers/$createdId" "PATCH" $patchBody
  if ($r.Status -eq 200 -and $r.Body.data.status -eq "Blocked") { Log "PATCH update Blocked" "PASS" "200 status=Blocked" } else { Log "PATCH update Blocked" "FAIL" $r.Status }

  # revert
  $revert = @{ status = $orig.Body.data.status; notes = $orig.Body.data.notes }
  Get-Json "$Base/api/admin/suppliers/$createdId" "PATCH" $revert | Out-Null
  Log "PATCH revert" "OK" "restored original values"
}

# 12.5 DELETE soft-delete
if ($createdId) {
  $before = Get-Json "$Base/api/admin/suppliers/$createdId"
  $origStatus = $before.Body.data.status
  $r = Get-Json "$Base/api/admin/suppliers/$createdId" "DELETE"
  if ($r.Status -eq 200 -and $r.Body.data.status -eq "Inactive") { Log "DELETE soft-delete" "PASS" "200 status=Inactive" } else { Log "DELETE soft-delete" "FAIL" "status=$($r.Status) data=$($r.Body.data.status)" }

  # restore status
  Get-Json "$Base/api/admin/suppliers/$createdId" "PATCH" @{ status = $origStatus } | Out-Null
  Log "DELETE restore status" "OK" "restored status=$origStatus"
}

# 12.6 error cases
$r = Get-Json "$Base/api/admin/suppliers" "POST" @{ contactEmail = "bad" }
if ($r.Status -eq 400) { Log "POST missing name" "PASS" "400" } else { Log "POST missing name" "FAIL" $r.Status }

$r = Get-Json "$Base/api/admin/suppliers" "POST" @{ name = "X"; contactEmail = "not-an-email" }
if ($r.Status -eq 400) { Log "POST invalid email" "PASS" "400" } else { Log "POST invalid email" "FAIL" $r.Status }

$r = Get-Json "$Base/api/admin/suppliers" "POST" @{ name = "X"; status = "Deleted" }
if ($r.Status -eq 400) { Log "POST invalid status" "PASS" "400" } else { Log "POST invalid status" "FAIL" $r.Status }

# 12.7 security
try {
  Get-Json "$Base/api/public/suppliers" | Out-Null
  Log "NO public suppliers route" "FAIL" "route exists"
} catch {
  Log "NO public suppliers route" "PASS" "404/not found"
}
$r = Get-Json "$Base/api/public/products?pageSize=1"
$jsonStr = ($r.Body | ConvertTo-Json -Depth 10)
$hasSupplierFields = $jsonStr -match 'supplierId|supplierReference|supplierCost'
if (-not $hasSupplierFields) { Log "Public products isolation" "PASS" "no supplier fields" } else { Log "Public products isolation" "FAIL" "supplier fields found" }

# cleanup: hard-delete test supplier via prisma (no hard-delete API)
if ($createdId) {
  Push-Location "c:\Users\mcarh\Desktop\AI_AGENTS\ProyectoPrueba\backend"
  "DELETE FROM `"Supplier`" WHERE id = $createdId;" | npx prisma db execute --stdin --schema prisma/schema.prisma 2>&1 | Out-Null
  Pop-Location
  Log "POST cleanup" "OK" "removed id=$createdId"
}

# Also remove leftover from prior session (id=1 if exists and is Curl Test Supplier)
Push-Location "c:\Users\mcarh\Desktop\AI_AGENTS\ProyectoPrueba\backend"
"DELETE FROM `"Supplier`" WHERE name LIKE 'Curl Test Supplier%';" | npx prisma db execute --stdin --schema prisma/schema.prisma 2>&1 | Out-Null
Pop-Location

$final = Get-Json "$Base/api/admin/suppliers"
Log "12.8 final count" "OK" "total=$($final.Body.data.total) (baseline was $($baseline.Body.data.total))"

$Results | Format-Table -AutoSize
$fail = ($Results | Where-Object { $_.Status -eq "FAIL" }).Count
Write-Host "FAILURES: $fail"
exit $fail
